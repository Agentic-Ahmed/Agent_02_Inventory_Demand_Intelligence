"""FastAPI dependencies: per-tenant context injection (CLAUDE.md S9).

Every request carries a tenant. For dev we read it from the X-Tenant-Id / X-User-Id
headers (default to 'acme' / 'planner1'); in prod this comes from Clerk/Supabase auth.
The orchestrator's specialist tools read their per-SKU data from the run context's
`dataset` bundle -- mock here, real sources later (CLAUDE.md S12.5).
"""
from fastapi import Header
from typing import Optional

from ..core.context import TenantContext, RunContext
from ..core.tenants import build_tenant_context
from ..testing.dummy_data import make_orchestrator_bundle


def get_tenant(
    x_tenant_id: Optional[str] = Header(default="acme"),
    x_user_role: Optional[str] = Header(default="planner"),
) -> TenantContext:
    """Per-request tenant: the tenant's OWN thresholds + the caller's role. Dev reads
    X-Tenant-Id / X-User-Role headers; prod from Clerk/Supabase auth (CLAUDE.md S9)."""
    return build_tenant_context(x_tenant_id or "acme", x_user_role or "planner")


def run_context_for(tenant: TenantContext, sku: str) -> RunContext:
    """Build a run context for a SKU, with the per-specialist data bundle attached."""
    return RunContext(tenant=tenant, sku=sku, dataset=make_orchestrator_bundle(sku))
