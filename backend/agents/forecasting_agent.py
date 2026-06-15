"""Demand Forecasting Agent (Agent #1) — two-phase pattern for Gemini.

Gemini cannot combine function-calling tools with forced JSON output in a single
request (CLAUDE.md S3 gotcha #4, confirmed live: 400 INVALID_ARGUMENT). So the
work is split into two agents:

  Phase 1 - data agent:  uses function tools to gather sales history + signals,
                         runs the INPUT guardrails (freshness, scope), and writes
                         a free-text analysis.   (function calling, no JSON)
  Phase 2 - formatter:   converts that analysis into a typed Forecast via the
                         SDK's structured output, and runs the OUTPUT guardrail
                         (confidence).            (JSON output, no tools)

This keeps every SDK feature in play (tools, structured output, both guardrail
layers, sessions) while staying within Gemini's constraints.
"""
from agents import Agent, ModelSettings, Runner

from ..core.config import GEMINI, AGENT_MODEL, agent_key
from ..models.schemas import Forecast
from ..tools.forecasting_tools import (
    get_sales_history,
    get_external_signals,
    log_forecast,
)
from ..guardrails.input_guardrails import data_freshness_guardrail, scope_guardrail
from ..guardrails.output_guardrails import confidence_guardrail

DATA_AGENT_INSTRUCTIONS = """You are a demand analyst for an e-commerce inventory system.
For the requested SKU:
1. Call get_sales_history to retrieve recent sales.
2. Call get_external_signals for weather/trend/promo factors.
3. Write a SHORT analysis in plain text (NO JSON): the recent demand level, any
   trend/seasonality, how volatile the data is, your point estimate of TOTAL
   demand over the requested horizon, and a rough confidence in [0,1] (use a
   lower value when the history is volatile or sparse).
Stay strictly within inventory/demand scope."""

FORMATTER_INSTRUCTIONS = """You convert a demand analyst's notes into a structured forecast.
Given the SKU, the horizon, and the analyst notes, output a Forecast with:
sku, horizon_days, predicted_units (integer >= 0), confidence in [0,1], and a
one-sentence reasoning. Use the analyst's point estimate and confidence."""


def build_forecasting_data_agent(model=None) -> Agent:
    """Phase 1: tool-using analyst. No output_type (so function calling works)."""
    if model is None:
        model = GEMINI(AGENT_MODEL["forecasting"], agent_key("forecasting"))
    return Agent(
        name="Demand Forecasting - Data Agent",
        instructions=DATA_AGENT_INSTRUCTIONS,
        model=model,
        model_settings=ModelSettings(include_usage=True),
        tools=[get_sales_history, get_external_signals, log_forecast],
        input_guardrails=[data_freshness_guardrail, scope_guardrail],
    )


def build_forecasting_formatter_agent(model=None) -> Agent:
    """Phase 2: structured formatter. output_type=Forecast, no tools."""
    if model is None:
        model = GEMINI(AGENT_MODEL["forecasting"], agent_key("forecasting"))
    return Agent(
        name="Demand Forecasting - Formatter",
        instructions=FORMATTER_INSTRUCTIONS,
        model=model,
        output_type=Forecast,
        model_settings=ModelSettings(include_usage=True),
        output_guardrails=[confidence_guardrail],
    )


async def run_forecast_pipeline(
    data_agent: Agent,
    formatter_agent: Agent,
    sku: str,
    horizon_days: int,
    run_ctx,
    session=None,
) -> Forecast:
    """Phase 1 (tools) -> Phase 2 (structured). Guardrail tripwires propagate
    to the caller, which routes them to the human-approval path."""
    analysis = await Runner.run(
        data_agent,
        f"Forecast {horizon_days}-day demand for SKU {sku}.",
        context=run_ctx,
        session=session,
    )
    formatted = await Runner.run(
        formatter_agent,
        f"SKU: {sku}\nHorizon (days): {horizon_days}\nAnalyst notes:\n{analysis.final_output}",
        context=run_ctx,
    )
    return formatted.final_output
