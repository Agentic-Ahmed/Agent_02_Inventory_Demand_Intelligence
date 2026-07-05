"""/api/events -- event-driven triggers over Redpanda (CLAUDE.md S7 event triggers).

  - POST /api/events        publish one inventory event (flash sale / supplier delay)
                            onto the stream, stamped with the caller's tenant.
  - POST /api/events/drain  consume a batch and wake the orchestrator per event. Meant to
                            be poked by cron / the uptime pinger (Render's free tier sleeps,
                            so we poll rather than hold a persistent consumer).

Each message carries its own tenant_id, so the drain runs every event for the tenant that
emitted it -- multi-tenancy survives the stream (CLAUDE.md S9). Drain is gated by an
optional CRON_SECRET header, since it isn't tenant-scoped (it services all tenants).
"""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from ...core.context import TenantContext
from ...core.events import get_stream, TOPIC
from ...core.tenants import build_tenant_context
from ..schemas import EventIn, EventPublishOut, DrainOut, DrainResult
from ..deps import get_tenant
from ..audit_store import AUDIT
from ..orchestration import run_orchestrator_collect

router = APIRouter(prefix="/api/events", tags=["events"])

_DRAIN_MAX = int(os.environ.get("EVENT_DRAIN_MAX", "5"))


@router.post("", response_model=EventPublishOut)
async def publish_event(ev: EventIn, tenant: TenantContext = Depends(get_tenant)) -> EventPublishOut:
    stream = get_stream()
    if stream is None:
        raise HTTPException(status_code=503, detail="event streaming not configured (REDPANDA_BROKERS unset)")
    envelope = {
        "tenant_id": tenant.tenant_id,
        "type": ev.type,
        "sku": ev.sku,
        "reason": ev.reason or ev.type,
        "magnitude": ev.magnitude,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await stream.publish(envelope, key=tenant.tenant_id)
    except Exception as exc:  # noqa: BLE001 - surface broker failure cleanly
        raise HTTPException(status_code=502, detail=f"publish failed: {type(exc).__name__}: {str(exc)[:160]}")
    AUDIT.log(tenant.tenant_id, "event_published", actor="event-stream",
              summary=f"{ev.type} for {ev.sku}", detail=envelope)
    return EventPublishOut(published=True, topic=TOPIC, key=tenant.tenant_id)


def _check_cron_secret(x_cron_secret: Optional[str]) -> None:
    """Guard the (non-tenant-scoped) drain with a shared secret when one is configured."""
    secret = os.environ.get("CRON_SECRET")
    if secret and x_cron_secret != secret:
        raise HTTPException(status_code=401, detail="invalid or missing X-Cron-Secret")


@router.post("/drain", response_model=DrainOut)
async def drain_events(
    max_messages: int = _DRAIN_MAX,
    x_cron_secret: Optional[str] = Header(default=None),
) -> DrainOut:
    _check_cron_secret(x_cron_secret)
    stream = get_stream()
    if stream is None:
        raise HTTPException(status_code=503, detail="event streaming not configured (REDPANDA_BROKERS unset)")

    events = await stream.drain(max_messages=max(1, min(max_messages, 25)))
    results: list[DrainResult] = []
    for msg in events:
        tid = msg.get("tenant_id")
        sku = msg.get("sku") or "SKU-1000"
        reason = msg.get("reason") or msg.get("type") or "event"
        if not tid:
            results.append(DrainResult(tenant_id="", sku=sku, reason=reason, error="missing tenant_id"))
            continue
        ctx = build_tenant_context(tid, "planner")
        prompt = (f"Event ({reason}) for SKU {sku}: re-check anomalies and demand "
                  f"and decide if an urgent reorder is needed.")
        try:
            # session=None: autonomous event runs are stateless (don't pollute chat memory).
            answer, _tools, escalations = await run_orchestrator_collect(prompt, ctx, sku, session=None)
            results.append(DrainResult(tenant_id=tid, sku=sku, reason=reason,
                                       answer=answer, escalations=escalations))
        except Exception as exc:  # noqa: BLE001 - one bad event must not fail the batch
            results.append(DrainResult(tenant_id=tid, sku=sku, reason=reason,
                                       error=f"{type(exc).__name__}: {str(exc)[:120]}"))
    return DrainOut(processed=len(results), results=results)
