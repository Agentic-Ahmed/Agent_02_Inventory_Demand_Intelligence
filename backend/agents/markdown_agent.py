"""Markdown / Pricing Agent (Agent #4) — two-phase pattern for Gemini.

Same Gemini constraint as the other specialists (tools XOR forced-JSON per
request), so the work is split:

  Phase 1 - data agent:  uses tools to read pricing/aging signals and (if it
                         acts) apply a markdown; runs the scope input guardrail;
                         writes a plain-text pricing analysis.   (function calling)
  Phase 2 - formatter:   converts the analysis into a typed MarkdownPlan and runs
                         the markdown-depth OUTPUT guardrail (> 40% -> VP review).
                                                                 (JSON output)

Clears aging / overstocked inventory by recommending a price cut. This changes a
price, it does NOT disburse funds, so there is no Google AP2 hook; the
apply_markdown tool still carries a hard ceiling so an over-deep cut is physically
impossible even if the model tries.
"""
from agents import Agent, ModelSettings, Runner

from ..core.config import GEMINI, AGENT_MODEL, agent_key
from ..models.schemas import MarkdownPlan
from ..tools.markdown_tools import get_pricing_signals, apply_markdown
from ..guardrails.input_guardrails import scope_guardrail
from ..guardrails.output_guardrails import markdown_depth_guardrail

DATA_AGENT_INSTRUCTIONS = """You are a markdown/pricing analyst for an e-commerce inventory system.
For the requested SKU:
1. Call get_pricing_signals to see current price, on-hand stock, days of supply,
   recent sell-through rate, and how long the stock has been aging.
2. Decide whether a markdown is warranted: slow sell-through, high days of supply,
   and older stock argue for a deeper cut; healthy sell-through argues for none.
3. Choose the SHALLOWEST markdown that will clear the stock. Prefer markdowns at or
   below 40%; only go deeper when the stock is badly overstocked and stale.
4. Write a SHORT plain-text analysis (NO JSON): whether to mark down, the depth as a
   percentage, the resulting price, and why. If no markdown is needed, say so.
Stay strictly within inventory/pricing scope."""

FORMATTER_INSTRUCTIONS = """You convert a pricing analyst's notes into a structured plan.
Output a MarkdownPlan with: sku, current_price, markdown_pct as a fraction in [0,1]
(0 = no markdown), new_price (= current_price * (1 - markdown_pct)), and a
one-sentence reasoning."""


def build_markdown_data_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["markdown"], agent_key("markdown"))
    return Agent(
        name="Markdown & Pricing - Data Agent",
        instructions=DATA_AGENT_INSTRUCTIONS,
        model=model,
        model_settings=ModelSettings(include_usage=True),
        tools=[get_pricing_signals, apply_markdown],
        input_guardrails=[scope_guardrail],
    )


def build_markdown_formatter_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["markdown"], agent_key("markdown"))
    return Agent(
        name="Markdown & Pricing - Formatter",
        instructions=FORMATTER_INSTRUCTIONS,
        model=model,
        output_type=MarkdownPlan,
        model_settings=ModelSettings(include_usage=True),
        output_guardrails=[markdown_depth_guardrail],
    )


async def run_markdown_pipeline(
    data_agent: Agent, formatter_agent: Agent, sku: str, run_ctx, session=None
) -> MarkdownPlan:
    """Phase 1 (tools) -> Phase 2 (structured). The markdown-depth tripwire
    propagates to the caller, which routes it to the VP/human-approval path."""
    analysis = await Runner.run(
        data_agent, f"Decide the markdown for SKU {sku}.", context=run_ctx, session=session
    )
    formatted = await Runner.run(
        formatter_agent,
        f"SKU: {sku}\nPricing analyst notes:\n{analysis.final_output}",
        context=run_ctx,
    )
    return formatted.final_output
