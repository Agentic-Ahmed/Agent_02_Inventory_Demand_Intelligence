"""Anomaly Detection Agent (Agent #5) — two-phase pattern for Gemini.

The system's always-on monitoring guardrail (CLAUDE.md: gemini-2.5-flash-lite,
"cheap, runs constantly"). It scans demand/inventory signals and flags anomalies
so bad data or demand shocks don't silently drive autonomous reorders/markdowns.

  Phase 1 - data agent:  calls get_monitoring_signals (and may raise an alert),
                         runs the scope input guardrail, writes a plain-text
                         assessment.                         (function calling)
  Phase 2 - formatter:   converts the assessment into a typed AnomalyReport and
                         runs the severity OUTPUT guardrail (HIGH -> halt
                         autonomous actions + human review).    (JSON output)

Detection-only: it takes no money/inventory action, so there is no AP2 hook or
tool hard limit; the severity guardrail is the safeguard.
"""
from agents import Agent, ModelSettings, Runner

from ..core.config import GEMINI, AGENT_MODEL, agent_key
from ..models.schemas import AnomalyReport
from ..tools.anomaly_tools import get_monitoring_signals, raise_anomaly_alert
from ..guardrails.input_guardrails import scope_guardrail
from ..guardrails.output_guardrails import anomaly_severity_guardrail

DATA_AGENT_INSTRUCTIONS = """You are an anomaly-detection analyst for an e-commerce inventory system.
For the requested SKU:
1. Call get_monitoring_signals to get the recent metric window plus the historical
   baseline (mean, std) and the expected range.
2. Decide whether the recent readings are anomalous: a large spike or collapse vs
   the baseline (e.g. several standard deviations out), or values outside the
   expected range / physically impossible (negative stock) are anomalies.
3. Classify the anomaly_type (none, demand_spike, demand_collapse, data_error,
   price_anomaly) and severity (none, low, medium, high). Reserve HIGH for clear,
   action-blocking anomalies (sharp shock or corrupt data).
4. Write a SHORT plain-text assessment (NO JSON): whether it's anomalous, the type,
   the severity, and a recommended action. If everything looks normal, say so.
Stay strictly within inventory/demand-monitoring scope."""

FORMATTER_INSTRUCTIONS = """You convert an anomaly analyst's notes into a structured report.
Output an AnomalyReport with: sku, is_anomaly (bool), anomaly_type, severity
(none/low/medium/high), recommended_action (monitor/escalate/halt_autonomous), and a
one-sentence reasoning. Use 'high' severity only for clear, action-blocking anomalies."""


def build_anomaly_data_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["anomaly"], agent_key("anomaly"))
    return Agent(
        name="Anomaly Detection - Data Agent",
        instructions=DATA_AGENT_INSTRUCTIONS,
        model=model,
        model_settings=ModelSettings(include_usage=True),
        tools=[get_monitoring_signals, raise_anomaly_alert],
        input_guardrails=[scope_guardrail],
    )


def build_anomaly_formatter_agent(model=None) -> Agent:
    if model is None:
        model = GEMINI(AGENT_MODEL["anomaly"], agent_key("anomaly"))
    return Agent(
        name="Anomaly Detection - Formatter",
        instructions=FORMATTER_INSTRUCTIONS,
        model=model,
        output_type=AnomalyReport,
        model_settings=ModelSettings(include_usage=True),
        output_guardrails=[anomaly_severity_guardrail],
    )


async def run_anomaly_pipeline(
    data_agent: Agent, formatter_agent: Agent, sku: str, run_ctx, session=None
) -> AnomalyReport:
    """Phase 1 (tools) -> Phase 2 (structured). A high-severity tripwire propagates
    to the caller, which halts autonomous downstream actions and routes to review."""
    analysis = await Runner.run(
        data_agent, f"Check SKU {sku} for demand/inventory anomalies.", context=run_ctx, session=session
    )
    formatted = await Runner.run(
        formatter_agent,
        f"SKU: {sku}\nAnomaly analyst notes:\n{analysis.final_output}",
        context=run_ctx,
    )
    return formatted.final_output
