"""FastAPI dependencies: per-tenant identity injection (CLAUDE.md S9).

Every request carries a tenant + a user role. Two sources, in priority order:
  1. Clerk session token (prod) -- when CLERK_* env is set, verify the JWT and read
     {tenant = org, role = org_role} from its claims (see core/auth.py).
  2. X-Tenant-Id / X-User-Role headers (dev) -- the stand-in used when no auth provider
     is configured yet, so the API is usable before Clerk is switched on.

The tenant's own guardrail thresholds come from the registry (core/tenants.py).
"""
import os
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException

from ..core import auth
from ..core.cache import rate_limit
from ..core.context import TenantContext, RunContext
from ..core.tenants import build_tenant_context
from ..testing.dummy_data import make_orchestrator_bundle

# Per-tenant chat rate limit (fixed window). Fail-open when Redis is off (see core.cache),
# so this is invisible until Upstash is configured. Tune without a redeploy via env.
_CHAT_LIMIT = int(os.environ.get("RATE_LIMIT_CHAT_PER_MIN", "60"))


def get_tenant(
    authorization: Optional[str] = Header(default=None),
    session: Optional[str] = Cookie(default=None, alias="__session"),  # Clerk's session cookie
    x_tenant_id: Optional[str] = Header(default="acme"),
    x_user_role: Optional[str] = Header(default="planner"),
    x_user_id: Optional[str] = Header(default="user"),
) -> TenantContext:
    """Resolve the caller's tenant + role + user id, then attach that tenant's thresholds.
    The user id keys per-user chat memory (see core.sessions)."""
    if auth.clerk_enabled():
        token = auth.bearer_token_from(authorization, session)
        if not token:
            raise HTTPException(status_code=401, detail="missing Clerk session token")
        try:
            claims = auth.verify_clerk_token(token)
        except Exception as exc:  # noqa: BLE001 - any verification failure = unauthorized
            raise HTTPException(status_code=401, detail=f"invalid session token: {type(exc).__name__}")
        tenant_id, role = auth.identity_from_claims(claims)
        ctx = build_tenant_context(tenant_id, role)
        ctx.user_id = auth.user_id_from_claims(claims)
        return ctx
    # Dev fallback: no auth provider configured yet -> trust the headers.
    ctx = build_tenant_context(x_tenant_id or "acme", x_user_role or "planner")
    ctx.user_id = x_user_id or "user"
    return ctx


async def chat_rate_limited(tenant: TenantContext = Depends(get_tenant)) -> TenantContext:
    """get_tenant + a per-tenant rate limit for the expensive chat endpoints, so a
    runaway client can't burn our Gemini quota. Fail-open: unlimited when Redis is off."""
    allowed, _remaining = await rate_limit(f"chat:{tenant.tenant_id}", _CHAT_LIMIT, 60)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached — too many requests. Please wait a moment and retry.",
        )
    return tenant


def run_context_for(tenant: TenantContext, sku: str) -> RunContext:
    """Build a run context for a SKU, with the per-specialist data bundle attached."""
    return RunContext(tenant=tenant, sku=sku, dataset=make_orchestrator_bundle(sku))
