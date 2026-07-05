"""POST /api/chat -- natural-language Q&A to the Orchestrator (CLAUDE.md S8 chat panel).

Runs the orchestrator (which coordinates the 5 specialists) and returns its answer,
the specialist tools it called, and any approval items created from escalations.

  - POST /api/chat         one-shot JSON response.
  - POST /api/chat/stream  Server-Sent Events: live tool calls + token deltas, then a
                           final 'done' event (CLAUDE.md S4 streaming events).
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ...core.context import TenantContext
from ..schemas import ChatRequest, ChatResponse
from ..deps import chat_rate_limited
from ..orchestration import run_orchestrator_collect, run_orchestrator_stream

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, tenant: TenantContext = Depends(chat_rate_limited)) -> ChatResponse:
    try:
        answer, tools, escalations = await run_orchestrator_collect(req.message, tenant, req.sku)
    except Exception as exc:  # noqa: BLE001 - surface model/quota failures cleanly
        raise HTTPException(
            status_code=503,
            detail=f"orchestrator unavailable: {type(exc).__name__}: {str(exc)[:200]}",
        )
    return ChatResponse(answer=answer, tools_called=tools, escalations=escalations)


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest, tenant: TenantContext = Depends(chat_rate_limited)) -> StreamingResponse:
    """SSE stream of one orchestrator turn. Events: tool_call, tool_output, text, done
    (and error if the run fails mid-stream, since headers are already sent)."""

    async def event_source():
        try:
            async for ev_type, payload in run_orchestrator_stream(req.message, tenant, req.sku):
                yield f"event: {ev_type}\ndata: {json.dumps(payload)}\n\n"
        except Exception as exc:  # noqa: BLE001 - report model/quota failure as an SSE error event
            err = {"detail": f"{type(exc).__name__}: {str(exc)[:200]}"}
            yield f"event: error\ndata: {json.dumps(err)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
