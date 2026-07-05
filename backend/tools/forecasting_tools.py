"""Function tools for the Demand Forecasting Agent.

Mostly mocked this pass (deterministic synthetic data); real Data Warehouse integrations
are deferred. EXCEPTION: get_external_signals now pulls REAL live weather (Open-Meteo,
free) -- the first genuinely-live tool. Every tool reads tenant-scoped data from the run
context (CLAUDE.md S9: always scope by tenant_id).
"""
import asyncio

from agents import function_tool, RunContextWrapper

from ..core.context import RunContext
from ..core.signals import fetch_weather


@function_tool
async def get_sales_history(ctx: RunContextWrapper[RunContext], sku: str, days: int = 90) -> dict:
    """Pull historical sales for a SKU over the last `days` days."""
    ds = ctx.context.dataset
    if ds is None:
        return {"sku": sku, "history": [], "note": "no data available"}
    return {
        "tenant_id": ctx.context.tenant.tenant_id,
        "sku": ds["sku"],
        "history": ds["history"][-days:],
        "data_age_hours": ds["data_age_hours"],
    }


def _merge_signals(dataset: dict | None, weather: dict) -> dict:
    """Combine the dataset's mock trend/promo signals with live weather (pure, testable).
    An empty weather dict (fetch failed) simply leaves the mock signals untouched."""
    signals = dict(dataset.get("signals", {})) if dataset else {}
    if weather:
        signals["weather"] = weather
    return signals


@function_tool
async def get_external_signals(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Fetch weather/trend/promo signals affecting demand for a SKU."""
    # Real live weather (Open-Meteo), run off-thread so the blocking fetch doesn't stall
    # the event loop. Crash-safe: an empty result leaves the mock signals in place.
    weather = await asyncio.to_thread(fetch_weather, ctx.context.tenant.tenant_id)
    return _merge_signals(ctx.context.dataset, weather)


@function_tool
async def log_forecast(
    ctx: RunContextWrapper[RunContext], sku: str, predicted_units: int, confidence: float
) -> str:
    """Store a forecast for later model evaluation (mock: no-op)."""
    return (
        f"Logged forecast for {sku}: {predicted_units} units "
        f"(confidence {confidence:.2f}) tenant={ctx.context.tenant.tenant_id}"
    )
