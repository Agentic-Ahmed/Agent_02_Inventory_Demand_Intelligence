"""/api/triggers -- scheduled (hourly cron) and event (flash-sale/supplier) entry
points (CLAUDE.md S7). Same orchestrator brain; only the trigger type differs.
"""
from fastapi import APIRouter, Depends

from ...core.context import TenantContext
from ..schemas import TriggerRequest, TriggerResponse
from ..deps import get_tenant
from ..orchestration import run_orchestrator_collect

router = APIRouter(prefix="/api/triggers", tags=["triggers"])

_PROMPTS = {
    "scheduled": "Hourly run for SKU {sku}: check for anomalies, forecast demand, and decide whether to reorder.",
    "event": "Event ({reason}) for SKU {sku}: re-check anomalies and demand and decide if an urgent reorder is needed.",
}


@router.post("", response_model=TriggerResponse)
async def fire_trigger(req: TriggerRequest, tenant: TenantContext = Depends(get_tenant)) -> TriggerResponse:
    prompt = _PROMPTS[req.type].format(sku=req.sku, reason=req.reason or "unspecified")
    try:
        answer, _tools, escalations = await run_orchestrator_collect(prompt, tenant, req.sku)
    except Exception as exc:  # noqa: BLE001 - accept the trigger; report the run failure
        return TriggerResponse(accepted=True, type=req.type, sku=req.sku,
                               answer=f"[run error] {type(exc).__name__}: {str(exc)[:120]}")
    return TriggerResponse(accepted=True, type=req.type, sku=req.sku, answer=answer, escalations=escalations)
