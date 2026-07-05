"""Per-tenant inventory + dashboard data for the console (CLAUDE.md S8 dashboard/explorer).

This is the SERVER-side source for the Dashboard KPIs, the Inventory health table, and the
per-SKU forecasts -- so the console reads them from the API instead of frontend fixtures.

For now the numbers are seeded per tenant (demo tenants get a realistic catalog; a fresh
workspace gets an empty one). This module is the single swap-point: when the real WMS /
data-warehouse feed lands (the mocked tools in CLAUDE.md S6), replace the SEED lookups with
live pulls and every screen goes real with no route or frontend change.

Forecasts are DERIVED here (a Python port of the console's forecast math) so a 1-day-cover
"critical" SKU projects an imminent stockout -- consistent with the inventory table.
"""
from __future__ import annotations

import math
from typing import Any

_HORIZONS = (7, 30, 90)
_HISTORY_DAYS = 28
_WEEKLY_AMPLITUDE = 0.18
_BASE_CONFIDENCE = {"healthy": 0.90, "low": 0.78, "critical": 0.68, "overstock": 0.86}
_TREND_PER_DAY = {"healthy": 0.002, "low": 0.006, "critical": 0.010, "overstock": -0.004}

# tenant_id -> {inventory: [...], dashboard: {...}}. Mirrors the two demo tenants so live
# mode matches preview; unknown tenants resolve to an empty workspace.
SEED: dict[str, dict[str, Any]] = {
    "acme": {
        "inventory": [
            {"sku": "SKU-1000", "name": "Trailhead Down Jacket", "on_hand": 142, "days_cover": 11, "status": "healthy"},
            {"sku": "SKU-1042", "name": "Merino Base Layer", "on_hand": 28, "days_cover": 3, "status": "low"},
            {"sku": "SKU-1108", "name": "Summit 45L Pack", "on_hand": 6, "days_cover": 1, "status": "critical"},
            {"sku": "SKU-1190", "name": "Cirrus Rain Shell", "on_hand": 880, "days_cover": 96, "status": "overstock"},
            {"sku": "SKU-1233", "name": "Trail Runner GTX", "on_hand": 210, "days_cover": 18, "status": "healthy"},
        ],
        "dashboard": {
            "forecast_accuracy": 0.913, "forecast_accuracy_delta": 0.027,
            "forecast_accuracy_trend": [0.878, 0.882, 0.879, 0.888, 0.886, 0.895, 0.899, 0.902, 0.905, 0.909, 0.911, 0.913],
            "stockout_rate": 0.018, "stockout_rate_delta": -0.041,
            "stockout_rate_trend": [0.072, 0.068, 0.07, 0.061, 0.058, 0.049, 0.045, 0.039, 0.031, 0.026, 0.021, 0.018],
            "capital_freed": 412_000, "capital_freed_delta": 86_000,
            "capital_freed_trend": [280_000, 300_000, 310_000, 326_000, 340_000, 352_000, 366_000, 378_000, 389_000, 398_000, 405_000, 412_000],
            "reorder_cycle_hours": 3.4,
            "reorder_cycle_trend": [6.2, 5.8, 5.5, 5.1, 4.7, 4.4, 4.1, 3.9, 3.7, 3.6, 3.5, 3.4],
        },
    },
    "cornershop": {
        "inventory": [
            {"sku": "SKU-2001", "name": "Cold Brew 12-pack", "on_hand": 64, "days_cover": 9, "status": "healthy"},
            {"sku": "SKU-2014", "name": "Oat Milk 1L", "on_hand": 12, "days_cover": 2, "status": "low"},
            {"sku": "SKU-2030", "name": "Seasonal Roast 1kg", "on_hand": 3, "days_cover": 1, "status": "critical"},
        ],
        "dashboard": {
            "forecast_accuracy": 0.864, "forecast_accuracy_delta": 0.012,
            "forecast_accuracy_trend": [0.842, 0.845, 0.848, 0.85, 0.849, 0.853, 0.856, 0.858, 0.86, 0.861, 0.863, 0.864],
            "stockout_rate": 0.046, "stockout_rate_delta": -0.018,
            "stockout_rate_trend": [0.071, 0.069, 0.066, 0.064, 0.061, 0.058, 0.056, 0.053, 0.051, 0.049, 0.047, 0.046],
            "capital_freed": 28_400, "capital_freed_delta": 5_200,
            "capital_freed_trend": [16_000, 17_800, 19_000, 20_500, 21_800, 23_000, 24_100, 25_200, 26_100, 27_000, 27_800, 28_400],
            "reorder_cycle_hours": 3.9,
            "reorder_cycle_trend": [5.4, 5.2, 5.0, 4.8, 4.6, 4.5, 4.3, 4.2, 4.1, 4.0, 3.95, 3.9],
        },
    },
}

_EMPTY_DASHBOARD = {
    "forecast_accuracy": 0.0, "forecast_accuracy_delta": 0.0, "forecast_accuracy_trend": [],
    "stockout_rate": 0.0, "stockout_rate_delta": 0.0, "stockout_rate_trend": [],
    "capital_freed": 0.0, "capital_freed_delta": 0.0, "capital_freed_trend": [],
    "reorder_cycle_hours": 0.0, "reorder_cycle_trend": [],
}


def dashboard_kpis(tenant_id: str) -> dict[str, Any]:
    entry = SEED.get(tenant_id)
    return dict(entry["dashboard"]) if entry else dict(_EMPTY_DASHBOARD)


def inventory_rows(tenant_id: str) -> list[dict[str, Any]]:
    # A tenant's own imported inventory wins over the seeded demo catalog (bring-your-own-
    # data); falls back to the seed for demo tenants, else an empty workspace.
    from .inventory_store import IMPORTED  # lazy: avoids import cycle at module load

    imported = IMPORTED.get(tenant_id)
    if imported is not None:
        return [dict(r) for r in imported]
    entry = SEED.get(tenant_id)
    return [dict(r) for r in entry["inventory"]] if entry else []


# ---- forecast derivation (Python port of frontend/src/lib/api/forecast.ts) ----

def _seeded_random(seed: str):
    """Deterministic RNG (mulberry32 over an FNV-1a hash) so a SKU always looks the same."""
    h = 2166136261
    for ch in seed:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    state = h

    def rnd() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return rnd


def _weekly(day: float) -> float:
    return 1 + _WEEKLY_AMPLITUDE * math.sin((day / 7) * 2 * math.pi)


def _forecast_for(row: dict[str, Any]) -> dict[str, Any]:
    rnd = _seeded_random(row["sku"])
    status = row["status"]
    on_hand = row["on_hand"]
    daily_base = max(1.0, on_hand / max(1, row["days_cover"]))
    trend = _TREND_PER_DAY.get(status, 0.002)
    base_conf = _BASE_CONFIDENCE.get(status, 0.8)

    history: list[int] = []
    for i in range(_HISTORY_DAYS - 1, -1, -1):
        day = -i
        noise = 1 + (rnd() - 0.5) * 0.25
        history.append(max(0, round(daily_base * _weekly(day) * (1 + trend * day) * noise)))

    def build_horizon(days: int) -> dict[str, Any]:
        points = []
        cumulative = 0.0
        stockout_day = None
        for d in range(1, days + 1):
            mean = max(0.0, daily_base * _weekly(d) * (1 + trend * d))
            spread = mean * (1 - base_conf) * (1 + d / days)
            points.append({
                "day": d,
                "mean": round(mean, 1),
                "lower": round(max(0.0, mean - spread), 1),
                "upper": round(mean + spread, 1),
            })
            cumulative += mean
            if stockout_day is None and cumulative >= on_hand:
                stockout_day = d
        total = sum(p["mean"] for p in points)
        penalty = 0.08 if days >= 90 else (0.04 if days >= 30 else 0.0)
        return {
            "days": days,
            "points": points,
            "predicted_total": round(total),
            "daily_mean": round(total / days, 1),
            "confidence": round(max(0.5, base_conf - penalty), 2),
            "projected_stockout_day": stockout_day,
        }

    return {
        "sku": row["sku"],
        "name": row["name"],
        "status": status,
        "on_hand": on_hand,
        "history": history,
        "horizons": {str(h): build_horizon(h) for h in _HORIZONS},
    }


def forecasts(tenant_id: str) -> list[dict[str, Any]]:
    return [_forecast_for(r) for r in inventory_rows(tenant_id)]
