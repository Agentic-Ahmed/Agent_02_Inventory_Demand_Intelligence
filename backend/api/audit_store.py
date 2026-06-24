"""Audit trail (CLAUDE.md S8 action log; S4 lifecycle hooks).

Append-only record of every autonomous decision + human action, per tenant: agent
runs, specialist tool calls + results, guardrail escalations, and approve/reject
decisions -- each timestamped and reasoned. Backed by SQLite (dev) or Postgres (prod)
via core.db -- same interface. Backend: an explicit AUDIT_DB path forces SQLite
(tests use :memory:); else DATABASE_URL -> Postgres; else a local audit.db.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..core.db import DB

_COLUMNS = ("id", "tenant_id", "ts", "event_type", "actor", "summary", "detail")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_item(row: dict) -> dict[str, Any]:
    item = {k: row.get(k) for k in _COLUMNS}
    d = item.get("detail")
    item["detail"] = json.loads(d) if isinstance(d, str) and d else (d or {})
    return item


class AuditLog:
    def __init__(self, sqlite_path: str = "audit.db", prefer_sqlite: bool = False) -> None:
        self.db = DB(sqlite_path, prefer_sqlite=prefer_sqlite)
        self.db.init([
            "CREATE TABLE IF NOT EXISTS audit ("
            "id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, ts TEXT NOT NULL, "
            "event_type TEXT NOT NULL, actor TEXT, summary TEXT, detail TEXT)",
            "CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit(tenant_id, ts)",
            "PRAGMA journal_mode=WAL",
        ])

    def log(self, tenant_id: str, event_type: str, actor: str = "",
            summary: str = "", detail: Optional[dict] = None) -> dict[str, Any]:
        item = {
            "id": uuid.uuid4().hex[:12],
            "tenant_id": tenant_id,
            "ts": _now(),
            "event_type": event_type,
            "actor": actor,
            "summary": summary,
            "detail": detail or {},
        }
        self.db.execute(
            "INSERT INTO audit (id, tenant_id, ts, event_type, actor, summary, detail) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (item["id"], tenant_id, item["ts"], event_type, actor, summary,
             json.dumps(item["detail"])),
        )
        return item

    def list(self, tenant_id: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = self.db.execute(
            "SELECT * FROM audit WHERE tenant_id=%s ORDER BY ts DESC, id DESC LIMIT %s",
            (tenant_id, max(1, min(limit, 1000))))
        return [_row_to_item(r) for r in (rows or [])]


# Module-level singleton. Explicit AUDIT_DB -> SQLite (tests); else DATABASE_URL
# -> Postgres; else local audit.db.
_override = os.environ.get("AUDIT_DB")
AUDIT = AuditLog(_override or "audit.db", prefer_sqlite=bool(_override))
