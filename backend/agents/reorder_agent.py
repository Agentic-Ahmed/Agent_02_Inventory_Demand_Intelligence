"""Reorder & Supplier Agent (Agent #2) — two-phase pattern for Gemini.

Same Gemini constraint as forecasting (tools XOR forced-JSON per request), so:

  Phase 1 - data agent:  uses tools to read current inventory + supplier quotes,
                         runs the scope input guardrail, and writes a plain-text
                         reorder analysis.            (function calling, no JSON)
  Phase 2 - formatter:   converts the analysis into a typed ReorderDecision and
                         runs the OUTPUT guardrails:
                           - spend            (> $10k -> human approval),
                           - supplier_diversity (> 60% share -> escalate).
                                                       (JSON output, no tools)

The actual purchase order (the money action) is executed separately via
create_purchase_order, which carries the tool-level hard ceiling and the Google
AP2 payment hook.
"""
from agents import Agent, ModelSettings, Runner

from ..core.config import GEMINI, AGENT_MODEL, agent_key
from ..models.schemas import ReorderDecision
from ..tools.reorder_tools import (
    get_current_inventory,
    get_supplier_quotes,
    create_purchase_order,
    send_buyer_alert,
)
from ..guardrails.input_guardrails import scope_guardrail
from ..guardrails.output_guardrails import spend_guardrail, supplier_diversity_guardrail

DATA_AGENT_INSTRUCTIONS = """You are a reorder analyst for an e-commerce inventory system.
For the requested SKU:
1. Call get_current_inventory to see on-hand stock, reorder point, and 7-day forecast.
2. Call get_supplier_quotes to see supplier prices, lead times, and category shares.
3. Decide whether a reorder is needed (on_hand below reorder_point + forecast demand).
   If needed, recommend a quantity, pick the best supplier (usually cheapest with
   acceptable lead time), and note that supplier's category share.
4. Write a SHORT plain-text analysis (NO JSON): whether to reorder, how much, which
   supplier at what unit price, the resulting total cost, and the supplier's share.
If no reorder is needed, say so. Stay strictly within inventory/supplier scope."""

FORMATTER_INSTRUCTIONS = """You convert a reorder analyst's notes into a structured decision.
Output a ReorderDecision with: sku, reorder_qty (0 if no reorder needed), supplier_id,
unit_cost, total_cost (= reorder_qty * unit_cost), supplier_category_share in [0,1], and a
one-sentence reasoning."""


def build_reorder_data_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["reorder"], agent_key("reorder"))
    return Agent(
        name="Reorder & Supplier - Data Agent",
        instructions=DATA_AGENT_INSTRUCTIONS,
        model=model,
        model_settings=ModelSettings(include_usage=True),
        tools=[get_current_inventory, get_supplier_quotes, create_purchase_order, send_buyer_alert],
        input_guardrails=[scope_guardrail],
    )


def build_reorder_formatter_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["reorder"], agent_key("reorder"))
    return Agent(
        name="Reorder & Supplier - Formatter",
        instructions=FORMATTER_INSTRUCTIONS,
        model=model,
        output_type=ReorderDecision,
        model_settings=ModelSettings(include_usage=True),
        output_guardrails=[spend_guardrail, supplier_diversity_guardrail],
    )


async def run_reorder_pipeline(
    data_agent: Agent, formatter_agent: Agent, sku: str, run_ctx, session=None
) -> ReorderDecision:
    """Phase 1 (tools) -> Phase 2 (structured). Spend / diversity tripwires
    propagate to the caller, which routes them to the human-approval path."""
    analysis = await Runner.run(
        data_agent, f"Decide the reorder for SKU {sku}.", context=run_ctx, session=session
    )
    formatted = await Runner.run(
        formatter_agent,
        f"SKU: {sku}\nReorder analyst notes:\n{analysis.final_output}",
        context=run_ctx,
    )
    return formatted.final_output
