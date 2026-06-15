"""Function tools for the Demand Forecasting Agent.

Mocked this pass (deterministic synthetic data); real Data Warehouse / External
API integrations are deferred. Every tool reads tenant-scoped data from the run
context (CLAUDE.md S9: always scope by tenant_id).
"""
from agents import function_tool, RunContextWrapper

from ..core.context import RunContext


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


@function_tool
async def get_external_signals(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Fetch weather/trend/promo signals affecting demand for a SKU."""
    ds = ctx.context.dataset
    if ds is None:
        return {}
    return ds.get("signals", {})


@function_tool
async def log_forecast(
    ctx: RunContextWrapper[RunContext], sku: str, predicted_units: int, confidence: float
) -> str:
    """Store a forecast for later model evaluation (mock: no-op)."""
    return (
        f"Logged forecast for {sku}: {predicted_units} units "
        f"(confidence {confidence:.2f}) tenant={ctx.context.tenant.tenant_id}"
    )
