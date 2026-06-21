"""/api/approvals -- the guardrail escalation queue (CLAUDE.md S8 approval inbox).

Money/price actions and low-confidence/critical results that tripped a guardrail
land here for an auditable Approve / Reject decision.
"""
from fastapi import APIRouter, Depends, HTTPException

from ...core.context import TenantContext
from ..schemas import ApprovalOut, ApprovalAction
from ..deps import get_tenant
from ..approval_store import STORE

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
    new_status = "approved" if body.action == "approve" else "rejected"
    resolved = STORE.resolve(item_id, new_status, body.by, body.note)
    if resolved is None:
        raise HTTPException(status_code=409, detail="approval item already resolved")
    return resolved
