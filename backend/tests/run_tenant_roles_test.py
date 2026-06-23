"""Offline test: per-tenant guardrail thresholds + role-based approval authority.

No API key / network. Proves:
  1. Each tenant carries its OWN thresholds (Acme large vs Corner Shop small).
  2. The spend guardrail uses them: the same $8k order auto-approves for Acme but
     escalates for Corner Shop.
  3. Approval authority: an item is owned by its agent's role; only that role -- or
     the Inventory Manager (lead) -- can resolve it (others get 403, cross-tenant 404).
  4. GET /api/tenant reflects the caller's tenant config + what their role can approve.

Run:  python -m backend.tests.run_tenant_roles_test   (use APPROVALS_DB=:memory: for a clean store)
"""
import asyncio

from agents import RunContextWrapper
from fastapi.testclient import TestClient

from ..core.context import RunContext
from ..core.tenants import build_tenant_context
from ..core.roles import BUYER, PRICER, MANAGER
from ..guardrails.output_guardrails import spend_guardrail
from ..models.schemas import ReorderDecision
from ..api.app import app
from ..api.approval_store import STORE


async def _spend_trips(tenant_id: str, total_cost: float) -> bool:
    """Run the real spend guardrail for a tenant against a PO of `total_cost`."""
    ctx = RunContext(tenant=build_tenant_context(tenant_id), sku="SKU-1")
    fn = getattr(spend_guardrail, "guardrail_function", spend_guardrail)
    out = ReorderDecision(sku="SKU-1", reorder_qty=10, supplier_id="S1",
                          unit_cost=total_cost / 10, total_cost=total_cost,
                          supplier_category_share=0.3)
    res = await fn(RunContextWrapper(context=ctx), None, out)
    return res.tripwire_triggered


def main() -> None:
    checks: list[tuple[str, bool]] = []

    # 1. thresholds differ per tenant
    acme = build_tenant_context("acme")
    shop = build_tenant_context("cornershop")
    checks.append(("acme PO limit = 50k", acme.po_auto_approve_limit == 50_000))
    checks.append(("cornershop PO limit = 2k", shop.po_auto_approve_limit == 2_000))
    checks.append(("markdown caps differ", acme.max_markdown != shop.max_markdown))

    # 2. same $8k order: acme auto-approves, cornershop escalates
    acme_trip = asyncio.run(_spend_trips("acme", 8_000))
    shop_trip = asyncio.run(_spend_trips("cornershop", 8_000))
    checks.append(("$8k order: acme auto-approves", acme_trip is False))
    checks.append(("$8k order: cornershop escalates", shop_trip is True))

    # 3. role-based approval authority via the API
    client = TestClient(app)

    def seed():  # a buyer-owned PO escalation for acme
        return STORE.create("acme", "purchase_order", "SKU-1000", "PO needs approval",
                            {"amount": 8000, "specialist": "reorder"}, required_role=BUYER)

    def H(role, tenant="acme"):
        return {"X-Tenant-Id": tenant, "X-User-Role": role}

    i1 = seed()
    r_wrong = client.post(f"/api/approvals/{i1['id']}", json={"action": "approve", "by": "p"}, headers=H(PRICER))
    checks.append(("pricer CANNOT approve buyer item (403)", r_wrong.status_code == 403))
    r_ok = client.post(f"/api/approvals/{i1['id']}", json={"action": "approve", "by": "b"}, headers=H(BUYER))
    checks.append(("buyer approves own item (200)", r_ok.status_code == 200 and r_ok.json()["status"] == "approved"))

    i2 = seed()
    r_mgr = client.post(f"/api/approvals/{i2['id']}", json={"action": "approve", "by": "m"}, headers=H(MANAGER))
    checks.append(("manager override approves (200)", r_mgr.status_code == 200))

    i3 = seed()
    r_other = client.post(f"/api/approvals/{i3['id']}", json={"action": "approve", "by": "x"},
                          headers=H("manager", tenant="other"))
    checks.append(("cross-tenant blocked (404)", r_other.status_code == 404))

    # 4. GET /api/tenant reflects per-tenant config + caller's powers
    t_acme = client.get("/api/tenant", headers=H("buyer")).json()
    checks.append(("GET /api/tenant acme limit = 50k", t_acme["thresholds"]["po_auto_approve_limit"] == 50_000))
    checks.append(("buyer can_approve reorder", "reorder" in t_acme["you"]["can_approve"]))
    checks.append(("buyer cannot approve markdown", "markdown" not in t_acme["you"]["can_approve"]))
    t_shop = client.get("/api/tenant", headers=H("manager", tenant="cornershop")).json()
    checks.append(("GET /api/tenant shop limit = 2k", t_shop["thresholds"]["po_auto_approve_limit"] == 2_000))
    checks.append(("manager can_approve all 5", len(t_shop["you"]["can_approve"]) == 5))

    print("=" * 64)
    print("  PER-TENANT THRESHOLDS + ROLE-BASED APPROVAL  --  TEST")
    print("=" * 64)
    for name, ok in checks:
        print(f"  [{'OK ' if ok else 'FAIL'}] {name}")
    print("=" * 64)
    if all(ok for _, ok in checks):
        print(f"  ALL {len(checks)} PASS")
    else:
        raise SystemExit("  FAILED")


if __name__ == "__main__":
    main()
