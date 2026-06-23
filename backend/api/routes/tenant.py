"""GET /api/tenant -- the calling tenant's config for the Settings screen (CLAUDE.md S8).

Returns this business's guardrail thresholds, its team (role -> person), and what the
current caller (by role) is allowed to approve. Per-tenant thresholds + per-role
authority are the heart of multi-tenancy (CLAUDE.md S9).
"""
from fastapi import APIRouter, Depends

from ...core.context import TenantContext
from ...core.roles import ROLE_LABEL, SPECIALIST_ROLE, can_approve
from ...core.tenants import tenant_config
from ..deps import get_tenant

router = APIRouter(prefix="/api", tags=["tenant"])


@router.get("/tenant")
async def get_tenant_info(tenant: TenantContext = Depends(get_tenant)) -> dict:
    cfg = tenant_config(tenant.tenant_id)
    role = tenant.user_role
    approvable = [spec for spec, owner in SPECIALIST_ROLE.items() if can_approve(role, owner)]
    return {
        "tenant_id": tenant.tenant_id,
        "name": cfg.get("name", tenant.tenant_id),
        "thresholds": {
            "po_auto_approve_limit": tenant.po_auto_approve_limit,
            "max_markdown": tenant.max_markdown,
            "min_confidence": tenant.min_confidence,
            "max_supplier_share": tenant.max_supplier_share,
            "hard_po_ceiling": tenant.hard_po_ceiling,
            "hard_markdown_ceiling": tenant.hard_markdown_ceiling,
        },
        "team": {r: {"label": ROLE_LABEL.get(r, r), "person": person}
                 for r, person in cfg.get("team", {}).items()},
        "you": {
            "role": role,
            "label": ROLE_LABEL.get(role, role),
            "can_approve": approvable,
        },
    }
