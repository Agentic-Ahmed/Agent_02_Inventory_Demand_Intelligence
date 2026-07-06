"""Dashboard KPIs, inventory health, and per-SKU forecasts (CLAUDE.md S8 dashboard/explorer).

Serves the console's read-only analytics from the server, per tenant:
  - GET /api/dashboard         headline KPIs (forecast accuracy, stockout rate, capital freed).
  - GET /api/inventory         stock health per SKU.
  - GET /api/forecasts         7/30/90-day demand forecasts, derived from inventory.
  - GET /api/signals/geocode   city -> coordinates for the per-tenant weather location (Settings).

Data comes from api.inventory_data (the swap-point for a real WMS / warehouse feed).
"""
from fastapi import APIRouter, Depends, Query

from ...core.context import TenantContext
from ...core.signals import geocode
from ..schemas import DashboardKpis, GeocodeOut, InventoryRow, SkuForecast
from ..deps import get_tenant
from ..inventory_data import dashboard_kpis, inventory_rows, forecasts

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/dashboard", response_model=DashboardKpis)
async def get_dashboard(tenant: TenantContext = Depends(get_tenant)) -> dict:
    return dashboard_kpis(tenant.tenant_id)


@router.get("/inventory", response_model=list[InventoryRow])
async def get_inventory(tenant: TenantContext = Depends(get_tenant)) -> list[dict]:
    return inventory_rows(tenant.tenant_id)


@router.get("/forecasts", response_model=list[SkuForecast])
async def get_forecasts(tenant: TenantContext = Depends(get_tenant)) -> list[dict]:
    return forecasts(tenant.tenant_id)


@router.get("/signals/geocode", response_model=GeocodeOut)
async def geocode_location(
    q: str = Query(default="", description="City / place name to look up"),
    tenant: TenantContext = Depends(get_tenant),
) -> dict:
    """Look up candidate coordinates for a place name so a tenant can set its weather
    location by city in Settings (Open-Meteo geocoding; free, no key)."""
    return {"query": q, "results": geocode(q)}
