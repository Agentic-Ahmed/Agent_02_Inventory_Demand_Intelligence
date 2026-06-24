"""Approval queue: where guardrail escalations land for human review (CLAUDE.md S8).

When a money/price action or a low-confidence/critical result trips a guardrail, it is
parked here for Approve / Reject rather than auto-executed. Each item carries the
`required_role` of the agent that raised it; the route enforces who may resolve it
(CLAUDE.md S9). Backed by SQLite (dev) or Postgres (prod) via core.db -- same interface.
Backend: an explicit APPROVALS_DB path forces SQLite (tests use :memory:); else
DATABASE_URL -> Postgres; else a local approvals.db.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..core.db import DB

_COLUMNS = (
    "id", "tenant_id", "action_type", "sku", "summary", "detail",
    "required_role", "status", "created_at", "resolved_at", "resolved_by",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_item(row: dict) -> dict[str, Any]:
    item = {k: row.get(k) for k in _COLUMNS}
    d = item.get("detail")
    item["detail"] = json.loads(d) if isinstance(d, str) and d else (d or {})
    return item


class ApprovalStore:
    def __init__(self, sqlite_path: str = "approvals.db", prefer_sqlite: bool = False) -> None:
        self.db = DB(sqlite_path, prefer_sqlite=prefer_sqlite)
        self.db.init([
            "CREATE TABLE IF NOT EXISTS approvals ("
            "id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, action_type TEXT NOT NULL, "
            "sku TEXT NOT NULL, summary TEXT NOT NULL, detail TEXT NOT NULL, "
            "required_role TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, "
            "resolved_at TEXT, resolved_by TEXT)",
            "ALTER TABLE approvals ADD COLUMN required_role TEXT",  # pre-existing DBs
            "CREATE INDEX IF NOT EXISTS idx_appr_tenant ON approvals(tenant_id, status, created_at)",
            "PRAGMA journal_mode=WAL",
        ])

    def create(self, tenant_id: str, action_type: str, sku: str, summary: str,
               detail: Optional[dict] = None, required_role: Optional[str] = None) -> dict[str, Any]:
        item = {
            "id": uuid.uuid4().hex[:12],
            "tenant_id": tenant_id,
            "action_type": action_type,
            "sku": sku,
            "summary": summary,
            "detail": detail or {},
            "required_role": required_role,
            "status": "pending",
            "created_at": _now(),
            "resolved_at": None,
            "resolved_by": None,
        }
        self.db.execute(
            "INSERT INTO approvals "
            "(id, tenant_id, action_type, sku, summary, detail, required_role, status, created_at, resolved_at, resolved_by) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (item["id"], tenant_id, action_type, sku, summary, json.dumps(item["detail"]),
             required_role, "pending", item["created_at"], None, None),
        )
        return item

    def list(self, tenant_id: str, status: Optional[str] = "pending") -> list[dict[str, Any]]:
        if status:
            rows = self.db.execute(
                "SELECT * FROM approvals WHERE tenant_id=%s AND status=%s ORDER BY created_at DESC",
                (tenant_id, status))
        else:
            rows = self.db.execute(
                "SELECT * FROM approvals WHERE tenant_id=%s ORDER BY created_at DESC", (tenant_id,))
        return [_row_to_item(r) for r in (rows or [])]

    def get(self, item_id: str) -> Optional[dict[str, Any]]:
        rows = self.db.execute("SELECT * FROM approvals WHERE id=%s", (item_id,))
        return _row_to_item(rows[0]) if rows else None

    def resolve(self, item_id: str, status: str, by: str, note: str = "") -> Optional[dict[str, Any]]:
        """Approve/reject a pending item atomically. Returns None if missing or already
        resolved (so the route can answer 404 / 409). The conditional UPDATE +
        rowcount check makes concurrent double-resolves safe."""
        rows = self.db.execute("SELECT detail, status FROM approvals WHERE id=%s", (item_id,))
        if not rows or rows[0]["status"] != "pending":
            return None
        d = rows[0]["detail"]
        detail = json.loads(d) if isinstance(d, str) and d else (d or {})
        if note:
            detail = {**detail, "resolution_note": note}
        changed = self.db.execute_count(
            "UPDATE approvals SET status=%s, resolved_at=%s, resolved_by=%s, detail=%s "
            "WHERE id=%s AND status='pending'",
            (status, _now(), by, json.dumps(detail), item_id))
        if not changed:
            return None  # lost the race / already resolved
        upd = self.db.execute("SELECT * FROM approvals WHERE id=%s", (item_id,))
        return _row_to_item(upd[0]) if upd else None


# Module-level singleton. Explicit APPROVALS_DB -> SQLite (tests); else DATABASE_URL
# -> Postgres; else local approvals.db.
_override = os.environ.get("APPROVALS_DB")
STORE = ApprovalStore(_override or "approvals.db", prefer_sqlite=bool(_override))
