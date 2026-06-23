"""Run the orchestrator for an API request and collect tool calls + escalations.

When a specialist tool returns status 'escalated_to_human' (a guardrail tripped),
an item is parked in the approval queue (STORE), tagged with the role of the agent
that raised it, so the Approval Inbox can surface it for the right person to
Approve / Reject -- money/price actions never auto-execute past a guardrail.

Two entry points share the same escalation logic:
  - run_orchestrator_collect: runs the turn and returns the final result in one shot.
  - run_orchestrator_stream:   async-generates live events for the SSE chat endpoint.
"""
import json
from typing import Any, Optional

from agents import Runner

from ..agents.orchestrator import build_orchestrator
from ..core.context import TenantContext
from ..core.roles import required_role_for
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


def _maybe_escalate(d: Optional[dict], tenant: TenantContext, sku: str) -> Optional[str]:
    """If a specialist output escalated to a human, park it in the approval queue,
    tagged with the owning role. Returns the new approval item id, or None."""
    if not (isinstance(d, dict) and d.get("status") == "escalated_to_human"):
        return None
    spec = d.get("specialist", "review")
    item = STORE.create(
        tenant.tenant_id, _ACTION_TYPE.get(spec, "review"), d.get("sku", sku),
        f"{spec} action for {d.get('sku', sku)} needs human approval "
        f"({d.get('reason', 'guardrail tripped')})",
        d,
        required_role=required_role_for(spec),
    )
    return item["id"]


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
            eid = _maybe_escalate(_tool_output_dict(it), tenant, sku)
            if eid:
                escalation_ids.append(eid)
    return (result.final_output or ""), tools_called, escalation_ids


async def run_orchestrator_stream(
    message: str, tenant: TenantContext, sku: str, orchestrator=None
):
    """Async-generate (event_type, payload) tuples for one orchestrator turn (SSE).

    Mirrors run_orchestrator_collect but yields live (CLAUDE.md S4 streaming events):
      - 'tool_call'   {tool}                              a specialist tool was invoked
      - 'tool_output' {specialist, status, escalation_id?}  its result (+ any escalation)
      - 'text'        {delta}                             a chunk of the final answer
      - 'done'        {answer, tools_called, escalations}  end of turn
    """
    ctx = run_context_for(tenant, sku)
    orch = orchestrator or build_orchestrator()
    tools_called: list[str] = []
    escalation_ids: list[str] = []

    result = Runner.run_streamed(orch, message, context=ctx, max_turns=20)
    async for event in result.stream_events():
        if event.type == "raw_response_event":
            data = getattr(event, "data", None)
            if getattr(data, "type", "") == "response.output_text.delta":
                delta = getattr(data, "delta", "")
                if delta:
                    yield "text", {"delta": delta}
        elif event.type == "run_item_stream_event":
            if event.name == "tool_called":
                name = getattr(getattr(event.item, "raw_item", None), "name", None)
                if name:
                    tools_called.append(name)
                    yield "tool_call", {"tool": name}
            elif event.name == "tool_output":
                d = _tool_output_dict(event.item)
                eid = _maybe_escalate(d, tenant, sku)
                payload = {
                    "specialist": (d or {}).get("specialist"),
                    "status": (d or {}).get("status"),
                }
                if eid:
                    escalation_ids.append(eid)
                    payload["escalation_id"] = eid
                yield "tool_output", payload

    yield "done", {
        "answer": result.final_output or "",
        "tools_called": tools_called,
        "escalations": escalation_ids,
    }
