"""Function tools for the Anomaly Detection Agent (Agent #5).

Mocked this pass (deterministic synthetic data); real telemetry/stream integration
deferred. Every tool reads tenant-scoped data from the run context (CLAUDE.md S9).

Detection-only agent: it reads monitoring signals and (optionally) raises an alert.
It takes NO money/inventory action, so there is no hard-limit tool here -- the
safeguard is the severity OUTPUT guardrail, which halts autonomous downstream
actions when a high-severity anomaly is detected.
"""
from agents import function_tool, RunContextWrapper

from ..core.context import RunContext


@function_tool
async def get_monitoring_signals(ctx: RunContextWrapper[RunContext], sku: str) -> dict:
    """Recent metric window for a SKU plus its historical baseline, so the agent
    can judge whether the latest readings are anomalous."""
    ds = ctx.context.dataset
    if ds is None:
        return {"sku": sku, "note": "no data available"}
    return {
        "tenant_id": ctx.context.tenant.tenant_id,
        "sku": ds["sku"],
        "recent_window": ds["recent_window"],
        "baseline_mean": ds["baseline_mean"],
        "baseline_std": ds["baseline_std"],
        "on_hand": ds["on_hand"],
        "expected_range": ds["expected_range"],
    }


@function_tool
async def raise_anomaly_alert(ctx: RunContextWrapper[RunContext], sku: str, message: str) -> str:
    """Notify the ops team of a detected anomaly (Slack/Email mock)."""
    return f"ANOMALY ALERT [tenant={ctx.context.tenant.tenant_id}] {sku}: {message}"
