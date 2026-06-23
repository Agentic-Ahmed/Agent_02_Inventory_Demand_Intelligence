"""GET /api/audit -- the action log / audit trail (CLAUDE.md S8).

Every autonomous decision (agent runs, specialist tool calls + results, escalations)
and every human approve/reject -- timestamped, reasoned, and scoped to the tenant.
"""
from fastapi import APIRouter, Depends

from ...core.context import TenantContext
from ..schemas import AuditOut
from ..deps import get_tenant
from ..audit_store import AUDIT

router = APIRouter(prefix="/api", tags=["audit"])


@router.get("/audit", response_model=list[AuditOut])
async def list_audit(limit: int = 100, tenant: TenantContext = Depends(get_tenant)):
    return AUDIT.list(tenant.tenant_id, limit=limit)
