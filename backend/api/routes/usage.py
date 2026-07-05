"""GET /api/usage -- per-tenant usage metering (CLAUDE.md S4 per-tenant metering).

Rolls up the audit log into the numbers a billing / usage view needs: agent runs,
total token usage, and decision/action counts -- scoped to the calling tenant.

The rollup re-scans the tenant's audit rows, so a short-TTL Redis cache absorbs bursts
of dashboard loads (a no-op when Upstash isn't configured; see core.cache).
"""
import os

from fastapi import APIRouter, Depends

from ...core.context import TenantContext
from ...core.cache import cache_get_json, cache_set_json
from ..schemas import UsageOut
from ..deps import get_tenant
from ..audit_store import AUDIT

router = APIRouter(prefix="/api", tags=["usage"])

_USAGE_TTL = int(os.environ.get("USAGE_CACHE_TTL", "30"))  # seconds


@router.get("/usage", response_model=UsageOut)
async def get_usage(tenant: TenantContext = Depends(get_tenant)) -> UsageOut:
    ckey = f"usage:{tenant.tenant_id}"
    cached = await cache_get_json(ckey)
    if cached is not None:
        return UsageOut(**cached)
    data = AUDIT.usage(tenant.tenant_id)
    await cache_set_json(ckey, data, ttl_seconds=_USAGE_TTL)
    return UsageOut(**data)
