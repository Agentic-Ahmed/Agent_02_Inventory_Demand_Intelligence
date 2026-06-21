"""Run the orchestrator for an API request and collect tool calls + escalations.

When a specialist tool returns status 'escalated_to_human' (a guardrail tripped),
an item is parked in the approval queue (STORE) so the Approval Inbox can surface
it for Approve/Reject -- money/price actions never auto-execute past a guardrail.
"""
import json
from typing import Any, Optional

from agents import Runner

from ..agents.orchestrator import build_orchestrator
from ..core.context import TenantContext
from .deps import run_context_for
from .approval_store import STORE

_ACTION_TYPE = {
    "forecasting": "forecast_review",
    "reorder": "purchase_order",
    "warehouse": "stock_transfer",
    "markdown": "markdown",
    "anomaly": "anomaly",
}


def _tool_output_dict(item: Any) -> Optional[dict]:
    out = getattr(item, "output", None)
    if isinstance(out, dict):
        return out
    if isinstance(out, str):
        try:
            return json.loads(out)
        except Exception:
            return None
    return None


async def run_orchestrator_collect(
    message: str, tenant: TenantContext, sku: str, orchestrator=None
) -> tuple[str, list[str], list[str]]:
    """Returns (final_answer, tools_called, escalation_item_ids)."""
    ctx = run_context_for(tenant, sku)
    orch = orchestrator or build_orchestrator()
    result = await Runner.run(orch, message, context=ctx, max_turns=20)

    tools_called: list[str] = []
    escalation_ids: list[str] = []
    for it in result.new_items:
        kind = getattr(it, "type", "")
        if kind == "tool_call_item":
            name = getattr(getattr(it, "raw_item", None), "name", None)
            if name:
                tools_called.append(name)
        elif kind == "tool_call_output_item":
            d = _tool_output_dict(it)
            if isinstance(d, dict) and d.get("status") == "escalated_to_human":
                spec = d.get("specialist", "review")
                item = STORE.create(
                    tenant.tenant_id, _ACTION_TYPE.get(spec, "review"), d.get("sku", sku),
                    f"{spec} action for {d.get('sku', sku)} needs human approval "
                    f"({d.get('reason', 'guardrail tripped')})",
                    d,
                )
                escalation_ids.append(item["id"])
    return (result.final_output or ""), tools_called, escalation_ids
