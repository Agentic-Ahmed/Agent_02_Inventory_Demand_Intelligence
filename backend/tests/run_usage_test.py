"""Offline test for per-tenant usage metering (GET /api/usage) -- no key, no network.

Seeds audit events and checks the rollup: agent runs, summed tokens, tool calls,
escalations, approvals, per-agent token split, and tenant isolation.

Run:  DATABASE_URL= AUDIT_DB=:memory: APPROVALS_DB=:memory: python -m backend.tests.run_usage_test
"""
from fastapi.testclient import TestClient

from ..api.app import app
from ..api.audit_store import AUDIT


def main() -> None:
    AUDIT.log("acme", "agent_start", "Inventory Orchestrator", "started")
    AUDIT.log("acme", "agent_end", "Inventory Orchestrator", "done", {"total_tokens": 1200})
    AUDIT.log("acme", "agent_end", "Inventory Orchestrator", "done", {"total_tokens": 800})
    AUDIT.log("acme", "tool_call", "decide_reorder", "calling")
    AUDIT.log("acme", "escalation", "reorder", "escalated")
    AUDIT.log("acme", "approval_resolved", "bianca", "approved")
    AUDIT.log("zzz", "agent_end", "X", "done", {"total_tokens": 9999})

    client = TestClient(app)
    u = client.get("/api/usage", headers={"X-Tenant-Id": "acme"}).json()
    other = client.get("/api/usage", headers={"X-Tenant-Id": "zzz"}).json()

    checks = [
        ("agent_runs = 2", u["agent_runs"] == 2),
        ("total_tokens = 2000", u["total_tokens"] == 2000),
        ("tool_calls = 1", u["tool_calls"] == 1),
        ("escalations = 1", u["escalations"] == 1),
        ("approvals_resolved = 1", u["approvals_resolved"] == 1),
        ("tokens_by_agent", u["tokens_by_agent"].get("Inventory Orchestrator") == 2000),
        ("tenant isolation (acme excludes zzz)", u["total_tokens"] == 2000),
        ("other tenant rolled up separately", other["total_tokens"] == 9999 and other["agent_runs"] == 1),
    ]

    print("=" * 60)
    print("  PER-TENANT USAGE METERING (GET /api/usage)  --  TEST")
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
