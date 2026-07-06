"""GET/PATCH /api/tenant -- the calling tenant's config for the Settings screen (CLAUDE.md S8).

GET returns this business's guardrail thresholds, its team (role -> person), and what the
current caller (by role) is allowed to approve. PATCH persists Settings edits (name +
guardrail thresholds) so they survive restarts AND flow into the agents' guardrails
(see core.tenants.build_tenant_context). Per-tenant thresholds + per-role authority are
the heart of multi-tenancy (CLAUDE.md S9); only an Admin or Inventory Manager may edit them.
"""
from fastapi import APIRouter, Depends, HTTPException

from ...core.context import TenantContext
from ...core.roles import ROLE_LABEL, SPECIALIST_ROLE, ADMIN, MANAGER, can_approve
from ...core.tenants import tenant_config, build_tenant_context
from ...core.tenant_settings import TENANT_SETTINGS, overrides
from ...core.signals import signal_location
from ..schemas import TenantPatch
from ..deps import get_tenant
from ..audit_store import AUDIT

router = APIRouter(prefix="/api", tags=["tenant"])

# Bounds so a Settings edit can't push a threshold to a nonsensical value.
_FRACTION_FIELDS = {"max_markdown", "min_confidence", "max_supplier_share", "hard_markdown_ceiling"}
_MONEY_FIELDS = {"po_auto_approve_limit", "hard_po_ceiling"}


def _signal_location_payload(tenant_id: str) -> dict:
    """The weather-signal location for a tenant: the effective coordinates plus whether
    they were set by the tenant (custom) or inherited from the default."""
    saved = overrides(tenant_id).get("location") or {}
    lat, lon = signal_location(tenant_id)
    return {
        "latitude": lat,
        "longitude": lon,
        "label": saved.get("label"),
        "custom": bool(saved),
    }


def _tenant_payload(tenant: TenantContext) -> dict:
    """The Settings payload for a tenant + caller (shared by GET and PATCH)."""
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
        "signal_location": _signal_location_payload(tenant.tenant_id),
        "team": {r: {"label": ROLE_LABEL.get(r, r), "person": person}
                 for r, person in cfg.get("team", {}).items()},
        "you": {
            "role": role,
            "label": ROLE_LABEL.get(role, role),
            "can_approve": approvable,
        },
    }


@router.get("/tenant")
async def get_tenant_info(tenant: TenantContext = Depends(get_tenant)) -> dict:
    return _tenant_payload(tenant)


@router.patch("/tenant")
async def update_tenant_info(patch: TenantPatch, tenant: TenantContext = Depends(get_tenant)) -> dict:
    # Only the Admin (or the Inventory Manager lead) may change a tenant's limits.
    if tenant.user_role not in (ADMIN, MANAGER):
        raise HTTPException(status_code=403, detail="only an Admin or Inventory Manager may change settings")

    thr = patch.thresholds.model_dump(exclude_none=True) if patch.thresholds else {}
    for k, v in thr.items():
        if k in _FRACTION_FIELDS and not (0.0 <= v <= 1.0):
            raise HTTPException(status_code=422, detail=f"{k} must be between 0 and 1")
        if k in _MONEY_FIELDS and v < 0:
            raise HTTPException(status_code=422, detail=f"{k} must be >= 0")

    name = patch.name.strip() if patch.name and patch.name.strip() else None

    # Weather-signal location: reset clears it; otherwise both lat AND lon must be sent.
    from ...core.tenant_settings import _UNSET
    location: object = _UNSET
    if patch.reset_signal_location:
        location = None
    elif patch.signal_latitude is not None or patch.signal_longitude is not None:
        if patch.signal_latitude is None or patch.signal_longitude is None:
            raise HTTPException(status_code=422, detail="both signal_latitude and signal_longitude are required")
        location = {"latitude": patch.signal_latitude, "longitude": patch.signal_longitude}
        if patch.signal_location_label:
            location["label"] = patch.signal_location_label

    if not thr and name is None and location is _UNSET:
        raise HTTPException(status_code=422, detail="nothing to update")

    TENANT_SETTINGS.save(tenant.tenant_id, name, thr, location=location)
    AUDIT.log(tenant.tenant_id, "settings_updated", actor=tenant.user_role,
              summary="tenant settings changed",
              detail={"name": name, "thresholds": thr,
                      "location": None if location is _UNSET else location})
    # Rebuild the context so the response reflects the just-saved thresholds.
    return _tenant_payload(build_tenant_context(tenant.tenant_id, tenant.user_role))
