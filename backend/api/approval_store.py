"""SQLite-backed approval queue: where guardrail escalations land for human review.

This is the backend of the Approval Inbox screen (CLAUDE.md S8): when a money/price
action or a low-confidence/critical result trips a guardrail, it is parked here for
Approve / Reject rather than auto-executed. Persisted to a local SQLite file so the
queue survives a server restart (mirrors the dev SQLiteSession). Swap for Postgres
(per-tenant, row-level security) in prod (CLAUDE.md S2/S9).

The public interface (create / list / get / resolve + the item dict shape) is
identical to the previous in-memory store, so routes and orchestration are unchanged.
DB path is configurable via the APPROVALS_DB env var (default 'approvals.db'; tests
pass ':memory:').
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

_COLUMNS = (
    "id", "tenant_id", "action_type", "sku", "summary",
    "detail", "status", "created_at", "resolved_at", "resolved_by",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_item(row: sqlite3.Row) -> dict[str, Any]:
    item = {k: row[k] for k in _COLUMNS}
    item["detail"] = json.loads(row["detail"]) if row["detail"] else {}
    return item


class ApprovalStore:
    def __init__(self, db_path: str = "approvals.db") -> None:
        self._lock = threading.Lock()
        # check_same_thread=False: FastAPI may touch the store from worker threads;
        # every access is serialised by self._lock, so single-connection use is safe.
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.execute(
                """CREATE TABLE IF NOT EXISTS approvals (
                    id          TEXT PRIMARY KEY,
                    tenant_id   TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    sku         TEXT NOT NULL,
                    summary     TEXT NOT NULL,
                    detail      TEXT NOT NULL,
                    status      TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    resolved_at TEXT,
                    resolved_by TEXT
                )"""
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_tenant_status "
                "ON approvals(tenant_id, status, created_at)"
            )
            try:
                self._conn.execute("PRAGMA journal_mode=WAL")  # better read/write concurrency
            except sqlite3.OperationalError:
                pass  # e.g. :memory: — harmless
            self._conn.commit()

    def create(self, tenant_id: str, action_type: str, sku: str, summary: str,
               detail: Optional[dict] = None) -> dict[str, Any]:
        item = {
            "id": uuid.uuid4().hex[:12],
            "tenant_id": tenant_id,
            "action_type": action_type,
            "sku": sku,
            "summary": summary,
            "detail": detail or {},
            "status": "pending",
            "created_at": _now(),
            "resolved_at": None,
            "resolved_by": None,
        }
        with self._lock:
            self._conn.execute(
                "INSERT INTO approvals "
                "(id, tenant_id, action_type, sku, summary, detail, status, created_at, resolved_at, resolved_by) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (item["id"], tenant_id, action_type, sku, summary, json.dumps(item["detail"]),
                 "pending", item["created_at"], None, None),
            )
            self._conn.commit()
        return item

    def list(self, tenant_id: str, status: Optional[str] = "pending") -> list[dict[str, Any]]:
        with self._lock:
            if status:
                cur = self._conn.execute(
                    "SELECT * FROM approvals WHERE tenant_id=? AND status=? ORDER BY created_at DESC",
                    (tenant_id, status),
                )
            else:
                cur = self._conn.execute(
                    "SELECT * FROM approvals WHERE tenant_id=? ORDER BY created_at DESC",
                    (tenant_id,),
                )
            return [_row_to_item(r) for r in cur.fetchall()]

    def get(self, item_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM approvals WHERE id=?", (item_id,)).fetchone()
            return _row_to_item(row) if row else None

    def resolve(self, item_id: str, status: str, by: str, note: str = "") -> Optional[dict[str, Any]]:
        """Approve/reject a pending item atomically. Returns None if it's missing or
        already resolved (so the route can answer 404 / 409)."""
        with self._lock:
            row = self._conn.execute("SELECT * FROM approvals WHERE id=?", (item_id,)).fetchone()
            if row is None or row["status"] != "pending":
                return None
            detail = json.loads(row["detail"]) if row["detail"] else {}
            if note:
                detail = {**detail, "resolution_note": note}
            self._conn.execute(
                "UPDATE approvals SET status=?, resolved_at=?, resolved_by=?, detail=? "
                "WHERE id=? AND status='pending'",
                (status, _now(), by, json.dumps(detail), item_id),
            )
            self._conn.commit()
            updated = self._conn.execute("SELECT * FROM approvals WHERE id=?", (item_id,)).fetchone()
            return _row_to_item(updated)


# Module-level singleton (dev): persisted to a local SQLite file so the queue
# survives restarts. Prod: per-tenant Postgres-backed store.
STORE = ApprovalStore(os.environ.get("APPROVALS_DB", "approvals.db"))
