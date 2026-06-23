"""Offline test for the audit trail (CLAUDE.md S8/S4) -- no API key, no network.

Proves:
  1. AuditLog stores + lists per tenant (isolation) and survives a restart.
  2. AuditHooks records agent + tool lifecycle (unit: call the hook methods).
  3. A real orchestrator turn (FakeModel) fires the hooks -> agent_start/agent_end logged.
  4. Escalations + human approvals are logged; GET /api/audit returns them, tenant-scoped.

Run:  AUDIT_DB=:memory: APPROVALS_DB=:memory: python -m backend.tests.run_audit_test
"""
import asyncio
import os
import tempfile

from fastapi.testclient import TestClient

from ..api import orchestration
from ..api.app import app
from ..api.audit_store import AuditLog, AUDIT
from ..core.tenants import build_tenant_context
from ..observability.audit_hooks import AuditHooks
from ..agents.orchestrator import build_orchestrator
from ..testing.fake_model import FakeModel


class _Tool:
    def __init__(self, name): self.name = name


class _Agent:
    def __init__(self, name): self.name = name


class _Wrap:
    """Stub run-context wrapper for the hook unit test."""
    def __init__(self, tenant_id):
        self.context = type("C", (), {"tenant": type("T", (), {"tenant_id": tenant_id})()})()
        self.usage = None


def main() -> None:
    checks: list[tuple[str, bool]] = []

    # 1. store: isolation + durability
    path = os.path.join(tempfile.mkdtemp(prefix="audit_"), "audit.db")
    log = AuditLog(path)
    log.log("acme", "agent_start", "Orchestrator", "started")
    log.log("acme", "tool_call", "decide_reorder", "calling")
    log.log("other", "agent_start", "Orchestrator", "started")
    checks.append(("acme sees 2", len(log.list("acme")) == 2))
    checks.append(("other sees 1", len(log.list("other")) == 1))
    checks.append(("survives restart", len(AuditLog(path).list("acme")) == 2))

    # 2. hooks unit: methods write the right events
    async def hook_unit():
        h = AuditHooks("acme", "SKU-1", store=log)
        await h.on_agent_start(_Wrap("acme"), _Agent("Orchestrator"))
        await h.on_tool_start(_Wrap("acme"), _Agent("Orchestrator"), _Tool("decide_reorder"))
        await h.on_tool_end(_Wrap("acme"), _Agent("Orchestrator"), _Tool("decide_reorder"),
                            {"specialist": "reorder", "status": "ok"})
        await h.on_agent_end(_Wrap("acme"), _Agent("Orchestrator"), "out")
    asyncio.run(hook_unit())
    ev = [e["event_type"] for e in log.list("acme")]
    checks.append(("hook logged tool_call", "tool_call" in ev))
    checks.append(("hook logged tool_result", "tool_result" in ev))
    checks.append(("hook logged agent_end", "agent_end" in ev))

    # 3. a real orchestrator turn fires the hooks -> global AUDIT gets agent_start/end
    orchestration.build_orchestrator = lambda: build_orchestrator(model=FakeModel("done"))
    asyncio.run(orchestration.run_orchestrator_collect(
        "Forecast demand for SKU-1000", build_tenant_context("acme"), "SKU-1000"))
    run_ev = [e["event_type"] for e in AUDIT.list("acme")]
    checks.append(("run logged agent_start", "agent_start" in run_ev))
    checks.append(("run logged agent_end", "agent_end" in run_ev))

    # 4. escalation + approval logged; GET /api/audit returns them, tenant-scoped
    eid = orchestration._maybe_escalate(
        {"status": "escalated_to_human", "specialist": "reorder", "sku": "SKU-1000", "reason": "spend"},
        build_tenant_context("acme"), "SKU-1000")
    client = TestClient(app)
    ap = client.post(f"/api/approvals/{eid}", json={"action": "approve", "by": "bianca"},
                     headers={"X-Tenant-Id": "acme", "X-User-Role": "buyer"})
    checks.append(("approve ok", ap.status_code == 200))
    audit = client.get("/api/audit", headers={"X-Tenant-Id": "acme"})
    atypes = [e["event_type"] for e in audit.json()]
    checks.append(("GET /api/audit 200", audit.status_code == 200))
    checks.append(("escalation logged", "escalation" in atypes))
    checks.append(("approval_resolved logged", "approval_resolved" in atypes))
    checks.append(("audit tenant-scoped", client.get("/api/audit", headers={"X-Tenant-Id": "zzz"}).json() == []))

    print("=" * 60)
    print("  AUDIT TRAIL (lifecycle hooks)  --  TEST")
    print("=" * 60)
    for name, ok in checks:
        print(f"  [{'OK ' if ok else 'FAIL'}] {name}")
    print("=" * 60)
    if all(ok for _, ok in checks):
        print(f"  ALL {len(checks)} PASS")
    else:
        raise SystemExit("  FAILED")


if __name__ == "__main__":
    main()
