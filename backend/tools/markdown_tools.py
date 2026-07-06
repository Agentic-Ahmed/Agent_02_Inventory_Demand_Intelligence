"""Function tools for the Markdown / Pricing Agent (Agent #4).

Mocked this pass (deterministic synthetic data); real Commerce Platform API
integration is deferred. Every tool reads tenant-scoped data from the run context
(CLAUDE.md S9: always scope by tenant_id).

PRICE ACTION (not a money/disbursement action): apply_markdown changes a product's
price on the commerce platform. It does NOT spend funds, so there is NO Google AP2
hook (AP2 is only for fund-disbursing tools like create_purchase_order). It DOES
carry a TOOL-LEVEL HARD LIMIT (Layer 3, CLAUDE.md S5): it physically refuses to
apply a markdown deeper than the tenant's hard ceiling, even if the model asks.
Division of responsibility:
  * the markdown-depth guardrail decides WHETHER a markdown needs VP approval
    (> max_markdown, 40%),
  * the hard ceiling here is the final backstop (never auto-cut deeper than 70%).
"""
import asyncio

from agents import function_tool, RunContextWrapper

from ..core.context import RunContext, TenantContext
from ..integrations import live_read, live_write


@function_tool
async def get_pricing_signals(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Pricing/aging signals for a SKU: current price, stock, days of supply,
    recent sell-through, and how long the stock has been aging."""
    tid = ctx.context.tenant.tenant_id
    # Live: a connected commerce platform serves the tenant's real pricing/aging data.
    live = await asyncio.to_thread(live_read, tid, "commerce", "pricing", {"sku": sku})
    if live is not None:
        return {"tenant_id": tid, "source": "commerce", "sku": sku, **live}
    ds = ctx.context.dataset
    if ds is None:
        return {"sku": sku, "note": "no data available"}
    return {
        "tenant_id": tid,
        "sku": ds["sku"],
        "current_price": ds["current_price"],
        "on_hand": ds["on_hand"],
        "days_of_supply": ds["days_of_supply"],
        "sell_through_rate": ds["sell_through_rate"],
        "age_days": ds["age_days"],
    }


def enforce_and_apply_markdown(
    tenant: TenantContext, sku: str, current_price: float, markdown_pct: float
) -> dict:
    """Core markdown application with the hard-limit check (plain fn so it can be
    unit tested directly). Refuses to cut deeper than the tenant's hard ceiling."""
    if markdown_pct > tenant.hard_markdown_ceiling:
        return {
            "status": "REJECTED",
            "reason": (
                f"markdown {markdown_pct:.0%} exceeds hard ceiling "
                f"{tenant.hard_markdown_ceiling:.0%}"
            ),
            "escalated": True,
        }
    new_price = round(current_price * (1 - markdown_pct), 2)
    return {
        "status": "APPLIED",
        "sku": sku,
        "markdown_pct": markdown_pct,
        "old_price": current_price,
        "new_price": new_price,
    }


@function_tool
async def apply_markdown(
    ctx: RunContextWrapper[RunContext], sku: str, current_price: float, markdown_pct: float
) -> dict:
    """Update a product's price on the commerce platform. Enforces the hard ceiling.

    The hard markdown ceiling is checked FIRST; only an approved markdown is then
    pushed to a connected commerce endpoint."""
    tenant = ctx.context.tenant
    result = enforce_and_apply_markdown(tenant, sku, current_price, markdown_pct)
    if result.get("status") == "APPLIED":
        live = await asyncio.to_thread(
            live_write, tenant.tenant_id, "commerce", "markdowns",
            {"sku": sku, "markdown_pct": markdown_pct,
             "old_price": current_price, "new_price": result["new_price"]})
        if live is not None:
            result["source"] = "commerce"
            result["vendor_response"] = live
    return result
