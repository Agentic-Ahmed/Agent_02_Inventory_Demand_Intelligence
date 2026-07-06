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


# Sentinel so save() can tell "location not provided" (leave as-is) apart from
# "location explicitly cleared" (None -> revert to the env/default location).
_UNSET = object()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _location_dict(v: Any) -> dict[str, Any]:
    """Parse a stored location blob into {latitude, longitude, label?}, or {} if unusable."""
    loc = json.loads(v) if isinstance(v, str) and v else (v or {})
    try:
        out: dict[str, Any] = {
            "latitude": float(loc["latitude"]), "longitude": float(loc["longitude"])}
    except (KeyError, TypeError, ValueError):
        return {}
    if loc.get("label"):
        out["label"] = str(loc["label"])
    return out


class TenantSettingsStore:
    def __init__(self, sqlite_path: str = "tenant_settings.db", prefer_sqlite: bool = False) -> None:
        self.db = DB(sqlite_path, prefer_sqlite=prefer_sqlite)
        # init() ignores errors from already-applied DDL, so the ALTER is a safe no-op
        # once the column exists (adds `location` to tables created before it landed).
        self.db.init([
            "CREATE TABLE IF NOT EXISTS tenant_settings ("
            "tenant_id TEXT PRIMARY KEY, name TEXT, thresholds TEXT, location TEXT, updated_at TEXT)",
            "ALTER TABLE tenant_settings ADD COLUMN location TEXT",
        ])

    def get(self, tenant_id: str) -> dict[str, Any]:
        """Persisted overrides {name?, thresholds{}, location{}} for a tenant, or {} if
        none / on error."""
        try:
            rows = self.db.execute(
                "SELECT name, thresholds, location FROM tenant_settings WHERE tenant_id=%s",
                (tenant_id,))
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
        loc = _location_dict(row.get("location"))
        if loc:
            out["location"] = loc
        return out

    def save(self, tenant_id: str, name: Optional[str] = None,
             thresholds_patch: Optional[dict] = None,
             location: Any = _UNSET) -> dict[str, Any]:
        """Merge a partial patch into the tenant's stored overrides (upsert). Only known
        threshold fields are kept (coerced to float). `location` is left untouched unless
        passed: a {latitude, longitude} dict sets it, None clears it (revert to default)."""
        cur = self.get(tenant_id)
        new_name = name if name is not None else cur.get("name")
        merged = dict(cur.get("thresholds", {}))
        for k, v in (thresholds_patch or {}).items():
            if k in THRESHOLD_FIELDS and v is not None:
                merged[k] = float(v)
        if location is _UNSET:
            new_loc = cur.get("location", {})
        else:
            new_loc = _location_dict(location) if location else {}
        # Upsert as delete+insert so it works identically on SQLite and Postgres.
        self.db.execute("DELETE FROM tenant_settings WHERE tenant_id=%s", (tenant_id,))
        self.db.execute(
            "INSERT INTO tenant_settings (tenant_id, name, thresholds, location, updated_at) "
            "VALUES (%s,%s,%s,%s,%s)",
            (tenant_id, new_name, json.dumps(merged),
             json.dumps(new_loc) if new_loc else None, _now()))
        out: dict[str, Any] = {}
        if new_name:
            out["name"] = new_name
        if merged:
            out["thresholds"] = merged
        if new_loc:
            out["location"] = new_loc
        return out


# Module-level singleton. Explicit TENANT_DB -> SQLite (tests); else DATABASE_URL
# -> Postgres; else a local tenant_settings.db.
_override = os.environ.get("TENANT_DB")
TENANT_SETTINGS = TenantSettingsStore(_override or "tenant_settings.db", prefer_sqlite=bool(_override))


def overrides(tenant_id: str) -> dict[str, Any]:
    """Crash-safe accessor used by core.tenants to merge saved Settings into defaults."""
    return TENANT_SETTINGS.get(tenant_id)
