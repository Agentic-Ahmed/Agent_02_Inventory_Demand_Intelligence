"""Persisted per-tenant Settings overrides (CLAUDE.md S8 Settings, S9 per-tenant thresholds).

The seeded registry (core.tenants) provides each tenant's DEFAULT name + guardrail
thresholds. When an admin edits the Settings screen (PATCH /api/tenant), the changed
values are stored HERE and override the defaults -- so the change (a) survives restarts
and (b) actually flows into the agents' guardrails, because build_tenant_context merges
these overrides into every run's TenantContext.

Reads are crash-safe (return {} on any error): build_tenant_context runs on EVERY request,
so a settings row that can't be read must degrade to "use defaults", never break the run.
Backed by SQLite (dev) / Postgres (prod) via core.db.

Backend: an explicit TENANT_DB path forces SQLite (tests use :memory:); else
DATABASE_URL -> Postgres; else a local tenant_settings.db.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from .db import DB

# The threshold fields a tenant may tune -- must match TenantContext + GET /api/tenant.
THRESHOLD_FIELDS = (
    "po_auto_approve_limit",
    "max_markdown",
    "min_confidence",
    "max_supplier_share",
    "hard_po_ceiling",
    "hard_markdown_ceiling",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TenantSettingsStore:
    def __init__(self, sqlite_path: str = "tenant_settings.db", prefer_sqlite: bool = False) -> None:
        self.db = DB(sqlite_path, prefer_sqlite=prefer_sqlite)
        self.db.init([
            "CREATE TABLE IF NOT EXISTS tenant_settings ("
            "tenant_id TEXT PRIMARY KEY, name TEXT, thresholds TEXT, updated_at TEXT)",
        ])

    def get(self, tenant_id: str) -> dict[str, Any]:
        """Persisted overrides {name?, thresholds{}} for a tenant, or {} if none / on error."""
        try:
            rows = self.db.execute(
                "SELECT name, thresholds FROM tenant_settings WHERE tenant_id=%s", (tenant_id,))
        except Exception:
            return {}
        if not rows:
            return {}
        row = rows[0]
        out: dict[str, Any] = {}
        if row.get("name"):
            out["name"] = row["name"]
        t = row.get("thresholds")
        thresholds = json.loads(t) if isinstance(t, str) and t else (t or {})
        if thresholds:
            out["thresholds"] = thresholds
        return out

    def save(self, tenant_id: str, name: Optional[str] = None,
             thresholds_patch: Optional[dict] = None) -> dict[str, Any]:
        """Merge a partial patch into the tenant's stored overrides (upsert). Only known
        threshold fields are kept, and each is coerced to float."""
        cur = self.get(tenant_id)
        new_name = name if name is not None else cur.get("name")
        merged = dict(cur.get("thresholds", {}))
        for k, v in (thresholds_patch or {}).items():
            if k in THRESHOLD_FIELDS and v is not None:
                merged[k] = float(v)
        # Upsert as delete+insert so it works identically on SQLite and Postgres.
        self.db.execute("DELETE FROM tenant_settings WHERE tenant_id=%s", (tenant_id,))
        self.db.execute(
            "INSERT INTO tenant_settings (tenant_id, name, thresholds, updated_at) "
            "VALUES (%s,%s,%s,%s)",
            (tenant_id, new_name, json.dumps(merged), _now()))
        out: dict[str, Any] = {}
        if new_name:
            out["name"] = new_name
        if merged:
            out["thresholds"] = merged
        return out


# Module-level singleton. Explicit TENANT_DB -> SQLite (tests); else DATABASE_URL
# -> Postgres; else a local tenant_settings.db.
_override = os.environ.get("TENANT_DB")
TENANT_SETTINGS = TenantSettingsStore(_override or "tenant_settings.db", prefer_sqlite=bool(_override))


def overrides(tenant_id: str) -> dict[str, Any]:
    """Crash-safe accessor used by core.tenants to merge saved Settings into defaults."""
    return TENANT_SETTINGS.get(tenant_id)
