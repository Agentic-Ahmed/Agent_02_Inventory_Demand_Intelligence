"""Function tools for the Warehouse Allocation Agent.

Mocked this pass (deterministic synthetic data); real WMS integration deferred.
Every tool reads tenant-scoped data from the run context (CLAUDE.md S9).

transfer_stock moves inventory between fulfillment centers. It does NOT spend
money (no AP2), but it carries a TOOL-LEVEL HARD LIMIT (Layer 3): you cannot move
more units than the source warehouse physically holds.
"""
from agents import function_tool, RunContextWrapper

from ..core.context import RunContext


@function_tool
async def get_warehouse_inventory(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Per-warehouse stock position for a SKU (on hand, safety stock, demand, capacity)."""
    ds = ctx.context.dataset
    if ds is None:
        return {"sku": sku, "warehouses": {}}
    return {
        "tenant_id": ctx.context.tenant.tenant_id,
        "sku": ds["sku"],
        "warehouses": ds["warehouses"],
    }


def enforce_and_transfer(warehouses: dict, sku: str, from_wh: str, to_wh: str, qty: int) -> dict:
    """Core transfer with the hard-limit check (plain fn so it can be unit tested).
    Physically refuses to move more units than the source holds."""
    source_on_hand = warehouses.get(from_wh, {}).get("on_hand", 0)
    if qty > source_on_hand:
        return {
            "status": "REJECTED",
            "reason": f"qty {qty} exceeds {from_wh} on_hand {source_on_hand}",
            "escalated": True,
        }
    return {"status": "TRANSFERRED", "sku": sku, "from": from_wh, "to": to_wh, "qty": qty}


@function_tool
async def transfer_stock(
    ctx: RunContextWrapper[RunContext], sku: str, from_warehouse: str, to_warehouse: str, qty: int
) -> dict:
    """Move inventory between fulfillment centers. Enforces the source-stock hard limit."""
    warehouses = (ctx.context.dataset or {}).get("warehouses", {})
    return enforce_and_transfer(warehouses, sku, from_warehouse, to_warehouse, qty)
