"""Clerk auth integration (CLAUDE.md S2 Auth) -- scaffolded; activates with keys.

Identity flows from Clerk's session JWT: when the CLERK_* env vars are set, the API
verifies the token on each request and reads {tenant = org, role = org_role} from its
claims. When they're absent (dev), deps.get_tenant falls back to the X-Tenant-Id /
X-User-Role headers, so the API stays usable until Clerk is switched on. Swapping in
the real provider is a config change (env + frontend sends the token), not a rewrite.

To activate later:
  1. Create a free Clerk app; in it create Organizations (= tenants) and custom org
     roles named to match ours: planner, buyer, allocator, pricer, analyst, manager.
  2. pip install "pyjwt[crypto]"   (use --use-feature=truststore behind the proxy)
  3. Set in backend/.env (gitignored):
       CLERK_SECRET_KEY=sk_...
       CLERK_PUBLISHABLE_KEY=pk_...
       CLERK_ISSUER=https://<your-subdomain>.clerk.accounts.dev   (or CLERK_JWKS_URL=...)
  4. The frontend sends the Clerk session token as `Authorization: Bearer <jwt>`
     (or the __session cookie).
"""
import os
from typing import Optional

from .roles import ROLES, MANAGER, ADMIN, PLANNER

CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY", "")
CLERK_ISSUER = os.environ.get("CLERK_ISSUER", "").rstrip("/")
CLERK_JWKS_URL = os.environ.get("CLERK_JWKS_URL", "")


def clerk_enabled() -> bool:
    """True once a secret key + a JWKS source (issuer or explicit URL) are configured."""
    return bool(CLERK_SECRET_KEY and (CLERK_JWKS_URL or CLERK_ISSUER))


def _is_production() -> bool:
    """Best-effort 'are we running in a deployed environment?' check. Explicit APP_ENV
    wins; otherwise Render sets RENDER=true automatically on every deploy."""
    if os.environ.get("APP_ENV", "").lower() in ("production", "prod"):
        return True
    return bool(os.environ.get("RENDER"))


def dev_auth_allowed() -> bool:
    """May the API trust the dev X-Tenant-Id / X-User-Role headers (no real sign-in)?

    Secure by default: the header-trust fallback runs in local development only. In a
    deployed environment it is refused unless explicitly opted in with
    ALLOW_INSECURE_DEV_AUTH=true -- so a production deploy that is missing its Clerk
    config fails CLOSED (401) instead of silently trusting client-supplied identity
    headers and exposing every tenant's data."""
    if os.environ.get("ALLOW_INSECURE_DEV_AUTH", "").lower() == "true":
        return True
    return not _is_production()


def map_clerk_role(org_role: Optional[str]) -> str:
    """Map a Clerk org role string (e.g. 'org:buyer', 'org:admin') to one of our ROLES.
    Name your Clerk org roles to match ours and they pass straight through."""
    if not org_role:
        return PLANNER
    name = org_role.split(":", 1)[-1].lower()  # "org:buyer" -> "buyer"
    if name in ROLES:
        return name
    if name == "admin":
        return ADMIN
    if name in ("owner", "lead", "manager"):
        return MANAGER
    return PLANNER


def identity_from_claims(claims: dict) -> tuple[str, str]:
    """Verified Clerk claims -> (tenant_id, role). Tenant = active org (slug preferred,
    else id); role = mapped org_role. No active org -> ('default', planner)."""
    tenant_id = claims.get("org_slug") or claims.get("org_id") or "default"
    role = map_clerk_role(claims.get("org_role"))
    return tenant_id, role


def user_id_from_claims(claims: dict) -> str:
    """Verified Clerk claims -> stable user id (the JWT subject). Keys per-user chat
    memory so one tenant's users don't share conversation history."""
    return claims.get("sub") or "user"


def bearer_token_from(authorization: Optional[str], session_cookie: Optional[str]) -> Optional[str]:
    """Pull the JWT from an 'Authorization: Bearer ...' header or the __session cookie."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return session_cookie or None


_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        import jwt  # lazy: only required once Clerk is enabled
        url = CLERK_JWKS_URL or f"{CLERK_ISSUER}/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(url)
    return _jwks_client


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk session JWT (RS256, via JWKS) and return its claims. Raises on an
    invalid/expired token. Requires pyjwt[crypto] + the CLERK_* env to be set."""
    import jwt  # lazy import
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
    kwargs = {"issuer": CLERK_ISSUER} if CLERK_ISSUER else {}
    return jwt.decode(
        token, signing_key, algorithms=["RS256"], options={"verify_aud": False}, **kwargs
    )
