"""Warehouse Allocation Agent (Agent #3) — two-phase pattern for Gemini.

  Phase 1 - data agent:  uses tools to read per-warehouse inventory and (if it
                         acts) move stock; runs the scope input guardrail; writes
                         a plain-text rebalancing analysis.   (function calling)
  Phase 2 - formatter:   converts the analysis into a typed AllocationPlan and
                         runs the stock-safety OUTPUT guardrail.   (JSON output)

Distributes inventory across fulfillment centers to balance stock without
dropping any source below its safety level. No money is spent (no AP2); the
transfer_stock tool carries a hard limit so you can't move more than a warehouse
physically holds.
"""
from agents import Agent, ModelSettings, Runner

from ..core.config import GEMINI, AGENT_MODEL, agent_key
from ..models.schemas import AllocationPlan
from ..tools.warehouse_tools import get_warehouse_inventory, transfer_stock
from ..guardrails.input_guardrails import scope_guardrail
from ..guardrails.output_guardrails import stock_safety_guardrail

DATA_AGENT_INSTRUCTIONS = """You are a warehouse allocation analyst for an e-commerce network.
For the requested SKU:
1. Call get_warehouse_inventory to see each fulfillment center's on-hand stock,
   safety stock, 7-day demand, and capacity.
2. Decide whether to rebalance: move surplus from over-stocked centers to those at
   risk of stockout, to minimize shipping distance and balance coverage.
3. NEVER recommend moving so much that a source drops below its safety stock.
4. Write a SHORT plain-text analysis (NO JSON): which transfers (from -> to, qty),
   or that no rebalancing is needed.
Stay strictly within inventory/warehouse scope."""

FORMATTER_INSTRUCTIONS = """You convert a warehouse analyst's notes into a structured plan.
Output an AllocationPlan with: sku, a list of transfers (each from_warehouse, to_warehouse,
qty), rebalance_units (total units moved, 0 if none), and a one-sentence reasoning."""


def build_warehouse_data_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["warehouse"], agent_key("warehouse"))
    return Agent(
        name="Warehouse Allocation - Data Agent",
        instructions=DATA_AGENT_INSTRUCTIONS,
        model=model,
        model_settings=ModelSettings(include_usage=True),
        tools=[get_warehouse_inventory, transfer_stock],
        input_guardrails=[scope_guardrail],
    )


def build_warehouse_formatter_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["warehouse"], agent_key("warehouse"))
    return Agent(
        name="Warehouse Allocation - Formatter",
        instructions=FORMATTER_INSTRUCTIONS,
        model=model,
        output_type=AllocationPlan,
        model_settings=ModelSettings(include_usage=True),
        output_guardrails=[stock_safety_guardrail],
    )


async def run_warehouse_pipeline(
    data_agent: Agent, formatter_agent: Agent, sku: str, run_ctx, session=None
) -> AllocationPlan:
    """Phase 1 (tools) -> Phase 2 (structured). The stock-safety tripwire
    propagates to the caller, which routes it to human review."""
    analysis = await Runner.run(
        data_agent, f"Plan the warehouse allocation for SKU {sku}.", context=run_ctx, session=session
    )
    formatted = await Runner.run(
        formatter_agent,
        f"SKU: {sku}\nAllocation analyst notes:\n{analysis.final_output}",
        context=run_ctx,
    )
    return formatted.final_output
