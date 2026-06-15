"""Function tools for the Reorder & Supplier Agent.

Mocked this pass (deterministic synthetic data); real WMS / Supplier Portal / ERP
integrations are deferred. Every tool reads tenant-scoped data from the run
context (CLAUDE.md S9: always scope by tenant_id).

MONEY ACTION: create_purchase_order is the only tool here that spends money. It
carries a TOOL-LEVEL HARD LIMIT (Layer 3, CLAUDE.md S5) so over-execution is
physically impossible even if the model tries. The authorized payment itself is
executed via Google AP2 (Agent Payments Protocol) -- mocked here, real later.
Division of responsibility:
  * guardrails (spend / supplier diversity) decide WHETHER to spend,
  * the hard ceiling here is the final backstop,
  * Google AP2 executes HOW the authorized payment settles.
"""
from agents import function_tool, RunContextWrapper

from ..core.context import RunContext, TenantContext


@function_tool
async def get_current_inventory(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Real-time stock position for a SKU."""
    ds = ctx.context.dataset
    if ds is None:
        return {"sku": sku, "note": "no data available"}
    return {
        "tenant_id": ctx.context.tenant.tenant_id,
        "sku": ds["sku"],
        "on_hand": ds["on_hand"],
        "reorder_point": ds["reorder_point"],
        "forecast_demand_7d": ds["forecast_demand_7d"],
    }


@function_tool
async def get_supplier_quotes(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Request reorder pricing from suppliers."""
    ds = ctx.context.dataset
    if ds is None:
        return {"sku": sku, "quotes": []}
    return {"sku": ds["sku"], "quotes": ds["quotes"]}


def enforce_and_submit_po(
    tenant: TenantContext, sku: str, qty: int, supplier_id: str, unit_cost: float
) -> dict:
    """Core PO submission with the hard-limit check (plain fn so it can be unit
    tested directly). Refuses to execute above the tenant's hard ceiling."""
    total = round(qty * unit_cost, 2)
    if total > tenant.hard_po_ceiling:
        return {
            "status": "REJECTED",
            "reason": f"total ${total:,.0f} exceeds hard ceiling ${tenant.hard_po_ceiling:,.0f}",
            "escalated": True,
        }
    # Real deployment: authorize + settle this payment via Google AP2
    # (Agent Payments Protocol) using a signed spend mandate. Mocked here.
    return {
        "status": "SUBMITTED",
        "sku": sku,
        "qty": qty,
        "supplier_id": supplier_id,
        "total_cost": total,
        "payment_protocol": "google-ap2 (mock)",
    }


@function_tool
async def create_purchase_order(
    ctx: RunContextWrapper[RunContext],
    sku: str,
    qty: int,
    supplier_id: str,
    unit_cost: float,
) -> dict:
    """Submit a purchase order to the supplier ERP. Enforces the hard ceiling."""
    return enforce_and_submit_po(ctx.context.tenant, sku, qty, supplier_id, unit_cost)


@function_tool
async def send_buyer_alert(ctx: RunContextWrapper[RunContext], sku: str, message: str) -> str:
    """Notify human buyers of a decision requiring approval (Slack/Email mock)."""
    return f"ALERT [tenant={ctx.context.tenant.tenant_id}] {sku}: {message}"
