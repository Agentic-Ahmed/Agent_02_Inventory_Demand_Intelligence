"""Output guardrails (Layer 2, CLAUDE.md S5): validate the agent's output before
it is returned.

- confidence_guardrail: if a forecast's confidence < min_confidence (0.70),
  trip the wire so the result is routed to human review rather than triggering
  an autonomous reorder — blueprint S5 #3.
"""
from agents import (
    Agent,
    GuardrailFunctionOutput,
    RunContextWrapper,
    output_guardrail,
)

from ..core.context import RunContext
from ..models.schemas import Forecast, ReorderDecision, AllocationPlan


@output_guardrail
async def confidence_guardrail(
    ctx: RunContextWrapper[RunContext], agent: Agent, output: Forecast
) -> GuardrailFunctionOutput:
    min_conf = ctx.context.tenant.min_confidence
    tripped = output.confidence < min_conf
    return GuardrailFunctionOutput(
        output_info={
            "type": "confidence",
            "confidence": output.confidence,
            "min_confidence": min_conf,
            "tripped": tripped,
        },
        tripwire_triggered=tripped,
    )


@output_guardrail
async def spend_guardrail(
    ctx: RunContextWrapper[RunContext], agent: Agent, output: ReorderDecision
) -> GuardrailFunctionOutput:
    """Spend guardrail (blueprint S5 #1): auto-approve POs under the limit; trip
    above it so the PO is routed to the human approval queue."""
    limit = ctx.context.tenant.po_auto_approve_limit
    tripped = output.total_cost > limit
    return GuardrailFunctionOutput(
        output_info={
            "type": "spend",
            "total_cost": output.total_cost,
            "limit": limit,
            "tripped": tripped,
        },
        tripwire_triggered=tripped,
    )


@output_guardrail
async def supplier_diversity_guardrail(
    ctx: RunContextWrapper[RunContext], agent: Agent, output: ReorderDecision
) -> GuardrailFunctionOutput:
    """Supplier diversity guardrail (blueprint S5 #4): no single supplier may hold
    more than max_supplier_share of category spend; trip -> escalate."""
    max_share = ctx.context.tenant.max_supplier_share
    tripped = output.supplier_category_share > max_share
    return GuardrailFunctionOutput(
        output_info={
            "type": "supplier_diversity",
            "supplier_category_share": output.supplier_category_share,
            "max_supplier_share": max_share,
            "tripped": tripped,
        },
        tripwire_triggered=tripped,
    )


@output_guardrail
async def stock_safety_guardrail(
    ctx: RunContextWrapper[RunContext], agent: Agent, output: AllocationPlan
) -> GuardrailFunctionOutput:
    """Stock-safety guardrail for warehouse allocation: trip if the proposed
    transfers would leave any source warehouse below its safety stock (risking a
    stockout at the source). Computed from the plan + per-warehouse data in
    context — not self-reported by the model."""
    warehouses = (ctx.context.dataset or {}).get("warehouses", {})
    post = {wh: data.get("on_hand", 0) for wh, data in warehouses.items()}
    for t in output.transfers:
        if t.from_warehouse in post:
            post[t.from_warehouse] -= t.qty
        post[t.to_warehouse] = post.get(t.to_warehouse, 0) + t.qty
    violations = [
        wh for wh, data in warehouses.items()
        if post.get(wh, 0) < data.get("safety_stock", 0)
    ]
    tripped = len(violations) > 0
    return GuardrailFunctionOutput(
        output_info={"type": "stock_safety", "violations": violations, "tripped": tripped},
        tripwire_triggered=tripped,
    )
