"""GET /api/usage -- per-tenant usage metering (CLAUDE.md S4 per-tenant metering).

Rolls up the audit log into the numbers a billing / usage view needs: agent runs,
total token usage, and decision/action counts -- scoped to the calling tenant.
"""
from fastapi import APIRouter, Depends

from ...core.context import TenantContext
from ..schemas import UsageOut
from ..deps import get_tenant
from ..audit_store import AUDIT

router = APIRouter(prefix="/api", tags=["usage"])


@router.get("/usage", response_model=UsageOut)
async def get_usage(tenant: TenantContext = Depends(get_tenant)) -> UsageOut:
    return AUDIT.usage(tenant.tenant_id)
