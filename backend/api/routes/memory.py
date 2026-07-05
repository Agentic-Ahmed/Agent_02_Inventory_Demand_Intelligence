"""/api/memory -- tenant-scoped semantic memory / RAG (CLAUDE.md S2 Vector DB, S9).

Add knowledge the agents can later recall BY MEANING (policies, facts, decisions),
and search it directly. Every operation is scoped to the caller's tenant. Returns 503
when semantic memory isn't configured (no QDRANT_URL) so the caller gets a clear signal.
"""
from fastapi import APIRouter, Depends, HTTPException

from ...core.context import TenantContext
from ...core.memory import get_memory
from ..schemas import MemoryAdd, MemoryOut, MemoryHit, MemorySearchOut
from ..deps import get_tenant
from ..audit_store import AUDIT

router = APIRouter(prefix="/api/memory", tags=["memory"])


def _require_memory():
    mem = get_memory()
    if mem is None:
        raise HTTPException(status_code=503, detail="semantic memory is not configured (set QDRANT_URL)")
    return mem


@router.post("", response_model=MemoryOut)
async def add_memory(body: MemoryAdd, tenant: TenantContext = Depends(get_tenant)) -> MemoryOut:
    mem = _require_memory()
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="text is required")
    kind = (body.kind or "note").strip() or "note"
    try:
        pid = await mem.add(tenant.tenant_id, text, kind=kind)
    except Exception as exc:  # noqa: BLE001 - surface embedding/Qdrant failure cleanly
        raise HTTPException(status_code=503, detail=f"memory add failed: {type(exc).__name__}")
    AUDIT.log(tenant.tenant_id, "memory_add", "memory", f"stored {kind} memory", {"id": pid})
    return MemoryOut(id=pid, kind=kind)


@router.get("/search", response_model=MemorySearchOut)
async def search_memory(q: str, limit: int = 5,
                        tenant: TenantContext = Depends(get_tenant)) -> MemorySearchOut:
    mem = _require_memory()
    try:
        hits = await mem.search(tenant.tenant_id, q, limit=max(1, min(limit, 20)))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"memory search failed: {type(exc).__name__}")
    return MemorySearchOut(query=q, hits=[MemoryHit(**h) for h in hits])
