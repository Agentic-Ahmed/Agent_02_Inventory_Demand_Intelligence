"""/api/approvals -- the guardrail escalation queue (CLAUDE.md S8 approval inbox).

Money/price actions and low-confidence/critical results that tripped a guardrail
land here for an auditable Approve / Reject decision. Each item is owned by the role
of the agent that raised it (CLAUDE.md S9): only that role -- or the Inventory
Manager (the lead) -- may resolve it. Every resolution is written to the audit trail.
"""
from fastapi import APIRouter, Depends, HTTPException

from ...core.context import TenantContext
from ...core.roles import can_approve
from ..schemas import ApprovalOut, ApprovalAction
from ..deps import get_tenant
from ..approval_store import STORE
from ..audit_store import AUDIT

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalOut])
async def list_approvals(status: str = "pending", tenant: TenantContext = Depends(get_tenant)):
    return STORE.list(tenant.tenant_id, status=status or None)


@router.post("/{item_id}", response_model=ApprovalOut)
async def resolve_approval(
    item_id: str, body: ApprovalAction, tenant: TenantContext = Depends(get_tenant)
) -> ApprovalOut:
    item = STORE.get(item_id)
    if item is None or item["tenant_id"] != tenant.tenant_id:
        raise HTTPException(status_code=404, detail="approval item not found")
    if not can_approve(tenant.user_role, item.get("required_role")):
        raise HTTPException(
            status_code=403,
            detail=(f"role '{tenant.user_role}' cannot approve a "
                    f"'{item.get('required_role')}' action — needs that role or the inventory manager"),
        )
    new_status = "approved" if body.action == "approve" else "rejected"
    resolved = STORE.resolve(item_id, new_status, body.by, body.note)
    if resolved is None:
        raise HTTPException(status_code=409, detail="approval item already resolved")
    AUDIT.log(tenant.tenant_id, "approval_resolved", body.by,
              f"{new_status} {item['action_type']} for {item['sku']}",
              {"approval_id": item_id, "status": new_status, "role": tenant.user_role, "note": body.note})
    return resolved
