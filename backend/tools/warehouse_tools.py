"""Function tools for the Warehouse Allocation Agent.

Mocked this pass (deterministic synthetic data); real WMS integration deferred.
Every tool reads tenant-scoped data from the run context (CLAUDE.md S9).

transfer_stock moves inventory between fulfillment centers. It does NOT spend
money (no AP2), but it carries a TOOL-LEVEL HARD LIMIT (Layer 3): you cannot move
more units than the source warehouse physically holds.
"""
import asyncio

from agents import function_tool, RunContextWrapper

from ..core.context import RunContext
from ..integrations import live_read, live_write


@function_tool
async def get_warehouse_inventory(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Per-warehouse stock position for a SKU (on hand, safety stock, demand, capacity)."""
    tid = ctx.context.tenant.tenant_id
    # Live: a connected WMS serves real per-warehouse positions.
    live = await asyncio.to_thread(live_read, tid, "wms", "warehouses", {"sku": sku})
    if live is not None:
        return {"tenant_id": tid, "source": "wms", "sku": sku, **live}
    ds = ctx.context.dataset
    if ds is None:
        return {"sku": sku, "warehouses": {}}
    return {
        "tenant_id": tid,
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
    """Move inventory between fulfillment centers. Enforces the source-stock hard limit.

    The hard limit (can't move more than the source holds) is checked FIRST; only an
    approved transfer is then executed against a connected WMS endpoint."""
    tid = ctx.context.tenant.tenant_id
    warehouses = (ctx.context.dataset or {}).get("warehouses", {})
    result = enforce_and_transfer(warehouses, sku, from_warehouse, to_warehouse, qty)
    if result.get("status") == "TRANSFERRED":
        live = await asyncio.to_thread(
            live_write, tid, "wms", "transfers",
            {"sku": sku, "from": from_warehouse, "to": to_warehouse, "qty": qty})
        if live is not None:
            result["source"] = "wms"
            result["vendor_response"] = live
    return result
