"""Per-tenant imported inventory (Settings -> Import data).

When a tenant uploads their inventory, the rows land here and OVERRIDE the seeded demo
catalog in api.inventory_data -- so their real SKUs power the Inventory table and the
per-SKU forecasts (the /api/inventory + /api/forecasts endpoints) with no other change.
This is the "bring your own data" loop: import once, the console goes live with your data.

One JSON blob of rows per tenant. Reads are crash-safe (return None on error) so the
insights endpoints never break just because the import row can't be read.
Backend: INVENTORY_DB path forces SQLite (tests :memory:); else DATABASE_URL -> Postgres;
else a local inventory_import.db.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from ..core.db import DB

_ALLOWED_STATUS = {"healthy", "low", "critical", "overstock"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def status_for(days_cover: int) -> str:
    """Derive stock-health status from days of cover (matches the demo semantics)."""
    if days_cover <= 1:
        return "critical"
    if days_cover <= 3:
        return "low"
    if days_cover >= 60:
        return "overstock"
    return "healthy"


def clean_rows(raw: list[dict]) -> list[dict[str, Any]]:
    """Validate + normalize imported rows; skips rows without a SKU. Derives status when
    missing/invalid so the import is forgiving of partial spreadsheets."""
    out: list[dict[str, Any]] = []
    for r in raw or []:
        sku = str(r.get("sku") or "").strip()
        if not sku:
            continue
        try:
            on_hand = max(0, int(r.get("on_hand") or 0))
            days_cover = max(0, int(r.get("days_cover") or 0))
        except (TypeError, ValueError):
            continue
        status = str(r.get("status") or "").strip().lower()
        if status not in _ALLOWED_STATUS:
            status = status_for(days_cover)
        out.append({
            "sku": sku,
            "name": str(r.get("name") or sku).strip(),
            "on_hand": on_hand,
            "days_cover": days_cover,
            "status": status,
        })
    return out


class ImportedInventoryStore:
    def __init__(self, sqlite_path: str = "inventory_import.db", prefer_sqlite: bool = False) -> None:
        self.db = DB(sqlite_path, prefer_sqlite=prefer_sqlite)
        self.db.init([
            "CREATE TABLE IF NOT EXISTS imported_inventory ("
            "tenant_id TEXT PRIMARY KEY, rows TEXT NOT NULL, updated_at TEXT NOT NULL)",
        ])

    def get(self, tenant_id: str) -> Optional[list[dict[str, Any]]]:
        """A tenant's imported rows, or None if they never imported / on error."""
        try:
            res = self.db.execute(
                "SELECT rows FROM imported_inventory WHERE tenant_id=%s", (tenant_id,))
        except Exception:
            return None
        if not res:
            return None
        raw = res[0].get("rows")
        try:
            rows = json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, ValueError):
            return None
        return rows or []

    def save(self, tenant_id: str, rows: list[dict]) -> list[dict[str, Any]]:
        cleaned = clean_rows(rows)
        self.db.execute("DELETE FROM imported_inventory WHERE tenant_id=%s", (tenant_id,))
        self.db.execute(
            "INSERT INTO imported_inventory (tenant_id, rows, updated_at) VALUES (%s,%s,%s)",
            (tenant_id, json.dumps(cleaned), _now()))
        return cleaned

    def clear(self, tenant_id: str) -> None:
        self.db.execute("DELETE FROM imported_inventory WHERE tenant_id=%s", (tenant_id,))


_override = os.environ.get("INVENTORY_DB")
IMPORTED = ImportedInventoryStore(_override or "inventory_import.db", prefer_sqlite=bool(_override))
