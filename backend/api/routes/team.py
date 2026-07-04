"""/api/team -- teammates & pending invitations (Settings -> Team & roles).

Invite a teammate and assign them one or more roles (a teammate may hold several,
so their approval authority is the union). The email is delivered as a real Clerk
organization invitation from the browser; the full role SET is recorded here,
tenant-scoped, and surfaced as a pending invite until it's accepted. Every invite
and revoke is written to the audit trail.
"""
from fastapi import APIRouter, Depends, HTTPException

from ...core.context import TenantContext
from ...core.roles import valid_roles
from ..schemas import InviteCreate, InviteOut
from ..deps import get_tenant
from ..invite_store import STORE
from ..audit_store import AUDIT

router = APIRouter(prefix="/api/team", tags=["team"])


@router.get("/invites", response_model=list[InviteOut])
async def list_invites(status: str = "pending", tenant: TenantContext = Depends(get_tenant)):
    # "all" (or empty) -> no status filter; otherwise filter by the given status.
    s = None if status in ("", "all") else status
    return STORE.list(tenant.tenant_id, status=s)


@router.post("/invites", response_model=InviteOut)
async def create_invite(body: InviteCreate, tenant: TenantContext = Depends(get_tenant)) -> InviteOut:
    email = (body.email or "").strip()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=422, detail="a valid email address is required")
    roles = valid_roles(body.roles)
    if not roles:
        raise HTTPException(status_code=422, detail="assign at least one valid role")
    item = STORE.create(tenant.tenant_id, email, roles, invited_by=tenant.user_role)
    AUDIT.log(tenant.tenant_id, "teammate_invited", tenant.user_role,
              f"invited {email} as {', '.join(roles)}",
              {"invite_id": item["id"], "email": email, "roles": roles})
    return item


@router.delete("/invites/{item_id}", response_model=InviteOut)
async def revoke_invite(item_id: str, tenant: TenantContext = Depends(get_tenant)) -> InviteOut:
    revoked = STORE.revoke(tenant.tenant_id, item_id)
    if revoked is None:
        raise HTTPException(status_code=404, detail="pending invite not found")
    AUDIT.log(tenant.tenant_id, "invite_revoked", tenant.user_role,
              f"revoked invite for {revoked['email']}", {"invite_id": item_id})
    return revoked
