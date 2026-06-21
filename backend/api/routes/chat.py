"""POST /api/chat -- natural-language Q&A to the Orchestrator (CLAUDE.md S8 chat panel).

Runs the orchestrator (which coordinates the 5 specialists) and returns its answer,
the specialist tools it called, and any approval items created from escalations.
"""
from fastapi import APIRouter, Depends, HTTPException

from ...core.context import TenantContext
from ..schemas import ChatRequest, ChatResponse
from ..deps import get_tenant
from ..orchestration import run_orchestrator_collect

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, tenant: TenantContext = Depends(get_tenant)) -> ChatResponse:
    try:
        answer, tools, escalations = await run_orchestrator_collect(req.message, tenant, req.sku)
    except Exception as exc:  # noqa: BLE001 - surface model/quota failures cleanly
        raise HTTPException(
            status_code=503,
            detail=f"orchestrator unavailable: {type(exc).__name__}: {str(exc)[:200]}",
        )
    return ChatResponse(answer=answer, tools_called=tools, escalations=escalations)
