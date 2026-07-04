"""Run the orchestrator for an API request and collect tool calls + escalations.

When a specialist tool returns status 'escalated_to_human' (a guardrail tripped),
an item is parked in the approval queue (STORE), tagged with the role of the agent
that raised it, and recorded in the audit trail. Money/price actions never
auto-execute past a guardrail.

Audit trail (CLAUDE.md S4/S8): every run is driven with AuditHooks, so agent runs +
specialist tool calls land in the audit log; escalations are logged here too.

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
from ..core.sessions import make_session
from ..observability.audit_hooks import AuditHooks
from .deps import run_context_for
from .approval_store import STORE
from .audit_store import AUDIT

# Sentinel so callers can pass session=None to explicitly disable memory (used by
# stateless triggers), while the default builds a per-(tenant, user) session.
_DEFAULT_SESSION = object()

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
    """If a specialist output escalated to a human, park it in the approval queue
    (tagged with the owning role) and record it in the audit trail. Returns the new
    approval item id, or None."""
    if not (isinstance(d, dict) and d.get("status") == "escalated_to_human"):
        return None
    spec = d.get("specialist", "review")
    item_sku = d.get("sku", sku)
    summary = f"{spec} action for {item_sku} needs human approval ({d.get('reason', 'guardrail tripped')})"
    item = STORE.create(
        tenant.tenant_id, _ACTION_TYPE.get(spec, "review"), item_sku, summary, d,
        required_role=required_role_for(spec),
    )
    AUDIT.log(tenant.tenant_id, "escalation", spec, summary,
              {"approval_id": item["id"], "sku": item_sku, "reason": d.get("reason")})
    return item["id"]


async def run_orchestrator_collect(
    message: str, tenant: TenantContext, sku: str, orchestrator=None, session=_DEFAULT_SESSION
) -> tuple[str, list[str], list[str]]:
    """Returns (final_answer, tools_called, escalation_item_ids).

    Per-(tenant, user) chat memory is on by default; pass session=None to disable it
    (e.g. for stateless scheduled/event triggers)."""
    ctx = run_context_for(tenant, sku)
    orch = orchestrator or build_orchestrator()
    sess = make_session(tenant.tenant_id, tenant.user_id) if session is _DEFAULT_SESSION else session
    result = await Runner.run(orch, message, context=ctx, max_turns=20,
                              hooks=AuditHooks(tenant.tenant_id, sku), session=sess)

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
    message: str, tenant: TenantContext, sku: str, orchestrator=None, session=_DEFAULT_SESSION
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
    sess = make_session(tenant.tenant_id, tenant.user_id) if session is _DEFAULT_SESSION else session
    tools_called: list[str] = []
    escalation_ids: list[str] = []

    result = Runner.run_streamed(orch, message, context=ctx, max_turns=20,
                                 hooks=AuditHooks(tenant.tenant_id, sku), session=sess)
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
