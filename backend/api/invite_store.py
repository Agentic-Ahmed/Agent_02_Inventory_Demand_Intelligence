"""Pending teammate invitations (Settings -> Team & roles -> Invite teammate).

A teammate can hold several of our roles at once (union of approval authority),
but a Clerk membership carries a single org role -- so the full role SET is kept
here, tenant-scoped, and shown in Team & roles until the invite is accepted. The
email itself is delivered as a real Clerk organization invitation from the browser.
Backed by SQLite (dev) or Postgres (prod) via core.db, like the approval queue.
Backend: an explicit INVITES_DB path forces SQLite (tests use :memory:); else
DATABASE_URL -> Postgres; else a local invites.db.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..core.db import DB

_COLUMNS = ("id", "tenant_id", "email", "roles", "invited_by", "status", "created_at", "revoked_at")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_item(row: dict) -> dict[str, Any]:
    item = {k: row.get(k) for k in _COLUMNS}
    r = item.get("roles")
    item["roles"] = json.loads(r) if isinstance(r, str) and r else (r or [])
    return item


class InviteStore:
    def __init__(self, sqlite_path: str = "invites.db", prefer_sqlite: bool = False) -> None:
        self.db = DB(sqlite_path, prefer_sqlite=prefer_sqlite)
        self.db.init([
            "CREATE TABLE IF NOT EXISTS invites ("
            "id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL, "
            "roles TEXT NOT NULL, invited_by TEXT, status TEXT NOT NULL, "
            "created_at TEXT NOT NULL, revoked_at TEXT)",
            "CREATE INDEX IF NOT EXISTS idx_inv_tenant ON invites(tenant_id, status, created_at)",
            "PRAGMA journal_mode=WAL",
        ])

    def create(self, tenant_id: str, email: str, roles: list, invited_by: str = "") -> dict[str, Any]:
        item = {
            "id": uuid.uuid4().hex[:12],
            "tenant_id": tenant_id,
            "email": email,
            "roles": list(roles),
            "invited_by": invited_by,
            "status": "pending",
            "created_at": _now(),
            "revoked_at": None,
        }
        self.db.execute(
            "INSERT INTO invites "
            "(id, tenant_id, email, roles, invited_by, status, created_at, revoked_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (item["id"], tenant_id, email, json.dumps(item["roles"]), invited_by,
             "pending", item["created_at"], None),
        )
        return item

    def list(self, tenant_id: str, status: Optional[str] = "pending") -> list[dict[str, Any]]:
        if status:
            rows = self.db.execute(
                "SELECT * FROM invites WHERE tenant_id=%s AND status=%s ORDER BY created_at DESC",
                (tenant_id, status))
        else:
            rows = self.db.execute(
                "SELECT * FROM invites WHERE tenant_id=%s ORDER BY created_at DESC", (tenant_id,))
        return [_row_to_item(r) for r in (rows or [])]

    def get(self, item_id: str) -> Optional[dict[str, Any]]:
        rows = self.db.execute("SELECT * FROM invites WHERE id=%s", (item_id,))
        return _row_to_item(rows[0]) if rows else None

    def revoke(self, tenant_id: str, item_id: str) -> Optional[dict[str, Any]]:
        """Revoke a pending invite (tenant-scoped). Returns None if missing/already
        resolved so the route can answer 404. Conditional UPDATE is race-safe."""
        changed = self.db.execute_count(
            "UPDATE invites SET status='revoked', revoked_at=%s "
            "WHERE id=%s AND tenant_id=%s AND status='pending'",
            (_now(), item_id, tenant_id))
        if not changed:
            return None
        rows = self.db.execute("SELECT * FROM invites WHERE id=%s", (item_id,))
        return _row_to_item(rows[0]) if rows else None


# Module-level singleton. Explicit INVITES_DB -> SQLite (tests); else DATABASE_URL
# -> Postgres; else local invites.db.
_override = os.environ.get("INVITES_DB")
STORE = InviteStore(_override or "invites.db", prefer_sqlite=bool(_override))
