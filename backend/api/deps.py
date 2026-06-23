"""FastAPI dependencies: per-tenant identity injection (CLAUDE.md S9).

Every request carries a tenant + a user role. Two sources, in priority order:
  1. Clerk session token (prod) -- when CLERK_* env is set, verify the JWT and read
     {tenant = org, role = org_role} from its claims (see core/auth.py).
  2. X-Tenant-Id / X-User-Role headers (dev) -- the stand-in used when no auth provider
     is configured yet, so the API is usable before Clerk is switched on.

The tenant's own guardrail thresholds come from the registry (core/tenants.py).
"""
from typing import Optional

from fastapi import Cookie, Header, HTTPException

from ..core import auth
from ..core.context import TenantContext, RunContext
from ..core.tenants import build_tenant_context
from ..testing.dummy_data import make_orchestrator_bundle


def get_tenant(
    authorization: Optional[str] = Header(default=None),
    session: Optional[str] = Cookie(default=None, alias="__session"),  # Clerk's session cookie
    x_tenant_id: Optional[str] = Header(default="acme"),
    x_user_role: Optional[str] = Header(default="planner"),
) -> TenantContext:
    """Resolve the caller's tenant + role, then attach that tenant's thresholds."""
    if auth.clerk_enabled():
        token = auth.bearer_token_from(authorization, session)
        if not token:
            raise HTTPException(status_code=401, detail="missing Clerk session token")
        try:
            claims = auth.verify_clerk_token(token)
        except Exception as exc:  # noqa: BLE001 - any verification failure = unauthorized
            raise HTTPException(status_code=401, detail=f"invalid session token: {type(exc).__name__}")
        tenant_id, role = auth.identity_from_claims(claims)
        return build_tenant_context(tenant_id, role)
    # Dev fallback: no auth provider configured yet -> trust the headers.
    return build_tenant_context(x_tenant_id or "acme", x_user_role or "planner")


def run_context_for(tenant: TenantContext, sku: str) -> RunContext:
    """Build a run context for a SKU, with the per-specialist data bundle attached."""
    return RunContext(tenant=tenant, sku=sku, dataset=make_orchestrator_bundle(sku))
