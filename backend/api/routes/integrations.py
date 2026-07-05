"""Settings -> Integrations + Import data (CLAUDE.md S8 Settings; S6 real integrations seam).

Lets a tenant bring their own data and connect their own tools:
  - GET    /api/integrations         list this tenant's connected systems.
  - POST   /api/integrations         connect (or re-connect) one system.
  - DELETE /api/integrations/{kind}  disconnect a system.
  - POST   /api/inventory/import     upload inventory rows -> powers /api/inventory + /api/forecasts.
  - DELETE /api/inventory/import     revert to the default/seeded catalog.

Changing connections or data is Admin/Manager-only (403 otherwise), mirroring PATCH /tenant.
"""
from fastapi import APIRouter, Depends, HTTPException

from ...core.context import TenantContext
from ...core.roles import ADMIN, MANAGER
from ..schemas import IntegrationConnect, IntegrationOut, InventoryImport, ImportResult
from ..deps import get_tenant
from ..integration_store import INTEGRATIONS, KINDS
from ..inventory_store import IMPORTED
from ..audit_store import AUDIT

router = APIRouter(prefix="/api", tags=["integrations"])


def _require_manager(tenant: TenantContext) -> None:
    if tenant.user_role not in (ADMIN, MANAGER):
        raise HTTPException(status_code=403, detail="only an Admin or Inventory Manager may change integrations")


@router.get("/integrations", response_model=list[IntegrationOut])
async def list_integrations(tenant: TenantContext = Depends(get_tenant)) -> list[dict]:
    return INTEGRATIONS.list(tenant.tenant_id)


@router.post("/integrations", response_model=IntegrationOut)
async def connect_integration(body: IntegrationConnect,
                              tenant: TenantContext = Depends(get_tenant)) -> dict:
    _require_manager(tenant)
    if body.kind not in KINDS:
        raise HTTPException(status_code=422, detail=f"unknown integration kind '{body.kind}'")
    item = INTEGRATIONS.connect(tenant.tenant_id, body.kind, body.label, body.config, body.secret)
    AUDIT.log(tenant.tenant_id, "integration_connected", actor=tenant.user_role,
              summary=f"connected {body.kind}", detail={"kind": body.kind, "label": item["label"]})
    return item


@router.delete("/integrations/{kind}")
async def disconnect_integration(kind: str, tenant: TenantContext = Depends(get_tenant)) -> dict:
    _require_manager(tenant)
    removed = INTEGRATIONS.disconnect(tenant.tenant_id, kind)
    if not removed:
        raise HTTPException(status_code=404, detail="integration not connected")
    AUDIT.log(tenant.tenant_id, "integration_disconnected", actor=tenant.user_role,
              summary=f"disconnected {kind}", detail={"kind": kind})
    return {"disconnected": True, "kind": kind}


@router.post("/inventory/import", response_model=ImportResult)
async def import_inventory(body: InventoryImport,
                           tenant: TenantContext = Depends(get_tenant)) -> dict:
    _require_manager(tenant)
    rows = [r.model_dump() for r in body.rows]
    saved = IMPORTED.save(tenant.tenant_id, rows)
    if not saved:
        raise HTTPException(status_code=422, detail="no valid rows found (need at least a sku per row)")
    AUDIT.log(tenant.tenant_id, "inventory_imported", actor=tenant.user_role,
              summary=f"imported {len(saved)} SKUs", detail={"count": len(saved)})
    return {"imported": len(saved), "source": "import"}


@router.delete("/inventory/import")
async def revert_inventory(tenant: TenantContext = Depends(get_tenant)) -> dict:
    _require_manager(tenant)
    IMPORTED.clear(tenant.tenant_id)
    AUDIT.log(tenant.tenant_id, "inventory_import_reverted", actor=tenant.user_role,
              summary="reverted to default inventory")
    return {"reverted": True}
