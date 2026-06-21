"""Inventory Orchestrator (the coordinator) — manager pattern.

The orchestrator is the single brain behind every trigger (scheduled / event /
human chat; CLAUDE.md S7). It runs on gemini-2.5-pro and coordinates the five
specialists, each exposed as a FUNCTION TOOL that runs that specialist's full
two-phase pipeline (the agents-as-tools / manager pattern, adapted to our
two-phase specialists). The orchestrator calls the tools it needs, then
synthesises a concise answer.

SDK features here: agents-as-tools (manager pattern), input guardrails (the
injection/scope screen at the front door), sessions (per-tenant memory, keyed
f"{tenant_id}:{user_id}"), structured specialist outputs, fallback-ready model.

Each specialist tool reads its slice of data from the run context's `dataset`
bundle (keys: forecast/reorder/warehouse/markdown/anomaly). In production those
slices come from the real data sources; in dev they're mock (CLAUDE.md S12.5).
When a specialist's guardrail trips (low confidence, over-spend, deep markdown,
safety breach, critical anomaly), the tool returns an `escalated_to_human` status
instead of a result, so the orchestrator surfaces it rather than claiming action.
"""
from agents import (
    Agent,
    ModelSettings,
    Runner,
    function_tool,
    RunContextWrapper,
    InputGuardrailTripwireTriggered,
    OutputGuardrailTripwireTriggered,
)

from ..core.config import AGENT_MODEL, agent_key
from ..core.fallback_model import agent_fallback_model
from ..core.context import RunContext
from ..guardrails.input_guardrails import scope_guardrail

from .forecasting_agent import (
    build_forecasting_data_agent, build_forecasting_formatter_agent, run_forecast_pipeline,
)
from .reorder_agent import (
    build_reorder_data_agent, build_reorder_formatter_agent, run_reorder_pipeline,
)
from .warehouse_agent import (
    build_warehouse_data_agent, build_warehouse_formatter_agent, run_warehouse_pipeline,
)
from .markdown_agent import (
    build_markdown_data_agent, build_markdown_formatter_agent, run_markdown_pipeline,
)
from .anomaly_agent import (
    build_anomaly_data_agent, build_anomaly_formatter_agent, run_anomaly_pipeline,
)

_TRIPWIRES = (InputGuardrailTripwireTriggered, OutputGuardrailTripwireTriggered)


def _sub_ctx(ctx: RunContextWrapper[RunContext], sku: str, ds) -> RunContext:
    """Build a per-SKU run context for a specialist from the orchestrator's context."""
    return RunContext(
        tenant=ctx.context.tenant, sku=sku,
        data_age_hours=(ds or {}).get("data_age_hours", 0.5), dataset=ds,
    )


def _slice(ctx: RunContextWrapper[RunContext], key: str):
    bundle = ctx.context.dataset or {}
    return bundle.get(key) if isinstance(bundle, dict) else None


@function_tool
async def forecast_demand(ctx: RunContextWrapper[RunContext], sku: str, horizon_days: int = 7) -> dict:
    """Forecast total demand for a SKU over the horizon (Demand Forecasting specialist)."""
    ds = _slice(ctx, "forecast")
    if ds is None:
        return {"specialist": "forecasting", "status": "no_data", "sku": sku}
    try:
        fc = await run_forecast_pipeline(
            build_forecasting_data_agent(), build_forecasting_formatter_agent(),
            sku, horizon_days, _sub_ctx(ctx, sku, ds), baseline_units=ds.get("mock_predicted_units"),
        )
        return {"specialist": "forecasting", **fc.model_dump()}
    except _TRIPWIRES as exc:
        return {"specialist": "forecasting", "status": "escalated_to_human", "reason": type(exc).__name__}


@function_tool
async def decide_reorder(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Decide whether/how much to reorder for a SKU (Reorder & Supplier specialist)."""
    ds = _slice(ctx, "reorder")
    if ds is None:
        return {"specialist": "reorder", "status": "no_data", "sku": sku}
    try:
        d = await run_reorder_pipeline(
            build_reorder_data_agent(), build_reorder_formatter_agent(), sku, _sub_ctx(ctx, sku, ds),
        )
        return {"specialist": "reorder", **d.model_dump()}
    except _TRIPWIRES as exc:
        return {"specialist": "reorder", "status": "escalated_to_human", "reason": type(exc).__name__}


@function_tool
async def plan_allocation(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Plan inter-warehouse stock rebalancing for a SKU (Warehouse Allocation specialist)."""
    ds = _slice(ctx, "warehouse")
    if ds is None:
        return {"specialist": "warehouse", "status": "no_data", "sku": sku}
    try:
        p = await run_warehouse_pipeline(
            build_warehouse_data_agent(), build_warehouse_formatter_agent(), sku, _sub_ctx(ctx, sku, ds),
        )
        return {"specialist": "warehouse", **p.model_dump()}
    except _TRIPWIRES as exc:
        return {"specialist": "warehouse", "status": "escalated_to_human", "reason": type(exc).__name__}


@function_tool
async def decide_markdown(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Decide a price markdown for a SKU (Markdown / Pricing specialist)."""
    ds = _slice(ctx, "markdown")
    if ds is None:
        return {"specialist": "markdown", "status": "no_data", "sku": sku}
    try:
        m = await run_markdown_pipeline(
            build_markdown_data_agent(), build_markdown_formatter_agent(), sku, _sub_ctx(ctx, sku, ds),
        )
        return {"specialist": "markdown", **m.model_dump()}
    except _TRIPWIRES as exc:
        return {"specialist": "markdown", "status": "escalated_to_human", "reason": type(exc).__name__}


@function_tool
async def check_anomaly(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Screen a SKU for demand/inventory anomalies (Anomaly Detection specialist)."""
    ds = _slice(ctx, "anomaly")
    if ds is None:
        return {"specialist": "anomaly", "status": "no_data", "sku": sku}
    try:
        a = await run_anomaly_pipeline(
            build_anomaly_data_agent(), build_anomaly_formatter_agent(), sku, _sub_ctx(ctx, sku, ds),
        )
        return {"specialist": "anomaly", **a.model_dump()}
    except _TRIPWIRES as exc:
        return {"specialist": "anomaly", "status": "escalated_to_human", "reason": type(exc).__name__}


SPECIALIST_TOOLS = [forecast_demand, decide_reorder, plan_allocation, decide_markdown, check_anomaly]

ORCHESTRATOR_INSTRUCTIONS = """You are the Inventory Orchestrator for an e-commerce inventory system.
You coordinate five specialists, each available as a tool:
- forecast_demand: predict demand for a SKU.
- decide_reorder: replenishment / purchase-order decision.
- plan_allocation: rebalance stock across warehouses.
- decide_markdown: pricing / markdown decision.
- check_anomaly: screen for data/demand anomalies.

For a request: call only the specialist tools you actually need, then give a SHORT,
actionable summary of what to do. Good practice: check_anomaly before acting on a SKU,
and forecast_demand before a reorder. If a tool returns status 'escalated_to_human',
clearly flag that it needs human approval and do NOT claim the action was executed.
Stay strictly within inventory / demand / supply / pricing scope."""


def build_orchestrator(model=None) -> Agent:
    """The coordinator agent (gemini-2.5-pro by default; fallback-ready)."""
    if model is None:
        model = agent_fallback_model("orchestrator", AGENT_MODEL["orchestrator"], agent_key("orchestrator"))
    return Agent(
        name="Inventory Orchestrator",
        instructions=ORCHESTRATOR_INSTRUCTIONS,
        model=model,
        model_settings=ModelSettings(include_usage=True),
        tools=SPECIALIST_TOOLS,
        input_guardrails=[scope_guardrail],
    )


async def run_orchestrator(query: str, run_ctx, session=None, orchestrator: Agent | None = None) -> str:
    """Run a single orchestrator turn. Use Runner.run_streamed in the Web UI for
    live 'thinking / calling tool X' events (CLAUDE.md S4)."""
    orch = orchestrator or build_orchestrator()
    result = await Runner.run(orch, query, context=run_ctx, session=session)
    return result.final_output
