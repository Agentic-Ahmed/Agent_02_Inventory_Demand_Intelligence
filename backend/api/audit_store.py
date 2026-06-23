"""SQLite-backed audit trail (CLAUDE.md S8 action log; S4 lifecycle hooks).

Append-only record of every autonomous decision + human action, per tenant: agent
runs, specialist tool calls + their results, guardrail escalations, and approve/reject
decisions -- each timestamped and reasoned. Local SQLite for dev (env AUDIT_DB,
default audit.db); Postgres in prod. Read-scoped by tenant_id, like the approval queue.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

_COLUMNS = ("id", "tenant_id", "ts", "event_type", "actor", "summary", "detail")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_item(row: sqlite3.Row) -> dict[str, Any]:
    item = {k: row[k] for k in _COLUMNS}
    item["detail"] = json.loads(row["detail"]) if row["detail"] else {}
    return item


class AuditLog:
    def __init__(self, db_path: str = "audit.db") -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.execute(
                """CREATE TABLE IF NOT EXISTS audit (
                    id         TEXT PRIMARY KEY,
                    tenant_id  TEXT NOT NULL,
                    ts         TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    actor      TEXT,
                    summary    TEXT,
                    detail     TEXT
                )"""
            )
            self._conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit(tenant_id, ts)")
            try:
                self._conn.execute("PRAGMA journal_mode=WAL")
            except sqlite3.OperationalError:
                pass  # e.g. :memory: — harmless
            self._conn.commit()

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
        with self._lock:
            self._conn.execute(
                "INSERT INTO audit (id, tenant_id, ts, event_type, actor, summary, detail) "
                "VALUES (?,?,?,?,?,?,?)",
                (item["id"], tenant_id, item["ts"], event_type, actor, summary,
                 json.dumps(item["detail"])),
            )
            self._conn.commit()
        return item

    def list(self, tenant_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock:
            cur = self._conn.execute(
                "SELECT * FROM audit WHERE tenant_id=? ORDER BY ts DESC, id DESC LIMIT ?",
                (tenant_id, max(1, min(limit, 1000))),
            )
            return [_row_to_item(r) for r in cur.fetchall()]


# Module-level singleton (dev). Prod: per-tenant Postgres-backed log.
AUDIT = AuditLog(os.environ.get("AUDIT_DB", "audit.db"))
