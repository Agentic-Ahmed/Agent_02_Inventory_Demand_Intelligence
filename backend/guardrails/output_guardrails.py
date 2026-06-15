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
from ..models.schemas import Forecast, ReorderDecision


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
