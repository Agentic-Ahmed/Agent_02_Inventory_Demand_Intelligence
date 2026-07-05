"""Per-tenant tool connections (Settings -> Integrations).

Lets a tenant connect their OWN systems (WMS, supplier ERP/EDI, commerce platform, data
warehouse, Slack, event stream) so the agents can eventually act on them. We store the
connection's kind + label + non-secret config (e.g. an endpoint URL) and a MASKED hint of
any credential (last 4 chars only) -- the raw secret is never persisted in this dev build,
so nothing sensitive lands in the DB. When an integration is wired to actually call a
vendor, the credential belongs in a secrets vault (env / KMS), not this table.

One connection per (tenant, kind); connecting again updates it. Tenant-scoped throughout.
Backend: INTEGRATIONS_DB path forces SQLite (tests :memory:); else DATABASE_URL -> Postgres;
else a local integrations.db.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..core.db import DB

# The systems a tenant can connect (matches the Settings -> Integrations catalog).
KINDS = {"wms", "erp", "commerce", "warehouse_data", "slack", "events"}

_COLUMNS = ("id", "tenant_id", "kind", "label", "config", "secret_hint", "status", "created_at", "updated_at")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mask(secret: Optional[str]) -> Optional[str]:
    """Keep only a trailing hint of a credential so the UI can show it's set."""
    s = (secret or "").strip()
    if not s:
        return None
    return f"****{s[-4:]}" if len(s) >= 4 else "****"


def _row_to_item(row: dict) -> dict[str, Any]:
    item = {k: row.get(k) for k in _COLUMNS}
    c = item.get("config")
    item["config"] = json.loads(c) if isinstance(c, str) and c else (c or {})
    return item


class IntegrationStore:
    def __init__(self, sqlite_path: str = "integrations.db", prefer_sqlite: bool = False) -> None:
        self.db = DB(sqlite_path, prefer_sqlite=prefer_sqlite)
        self.db.init([
            "CREATE TABLE IF NOT EXISTS integrations ("
            "id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, kind TEXT NOT NULL, label TEXT, "
            "config TEXT, secret_hint TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, "
            "updated_at TEXT NOT NULL)",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_intg_tenant_kind ON integrations(tenant_id, kind)",
        ])

    def list(self, tenant_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            "SELECT * FROM integrations WHERE tenant_id=%s ORDER BY kind", (tenant_id,))
        return [_row_to_item(r) for r in (rows or [])]

    def connect(self, tenant_id: str, kind: str, label: str = "",
                config: Optional[dict] = None, secret: Optional[str] = None) -> dict[str, Any]:
        """Connect (or re-connect) a system for a tenant. Upsert on (tenant, kind)."""
        existing = self.db.execute(
            "SELECT id, created_at FROM integrations WHERE tenant_id=%s AND kind=%s", (tenant_id, kind))
        created_at = existing[0]["created_at"] if existing else _now()
        iid = existing[0]["id"] if existing else uuid.uuid4().hex[:12]
        item = {
            "id": iid,
            "tenant_id": tenant_id,
            "kind": kind,
            "label": label or kind,
            "config": dict(config or {}),
            "secret_hint": _mask(secret),
            "status": "connected",
            "created_at": created_at,
            "updated_at": _now(),
        }
        # Delete-then-insert keeps it identical on SQLite + Postgres (no ON CONFLICT).
        self.db.execute("DELETE FROM integrations WHERE tenant_id=%s AND kind=%s", (tenant_id, kind))
        self.db.execute(
            "INSERT INTO integrations "
            "(id, tenant_id, kind, label, config, secret_hint, status, created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (item["id"], tenant_id, kind, item["label"], json.dumps(item["config"]),
             item["secret_hint"], "connected", created_at, item["updated_at"]),
        )
        return item

    def disconnect(self, tenant_id: str, kind: str) -> bool:
        """Remove a connection (tenant-scoped). Returns True if one was removed."""
        return bool(self.db.execute_count(
            "DELETE FROM integrations WHERE tenant_id=%s AND kind=%s", (tenant_id, kind)))


_override = os.environ.get("INTEGRATIONS_DB")
INTEGRATIONS = IntegrationStore(_override or "integrations.db", prefer_sqlite=bool(_override))
