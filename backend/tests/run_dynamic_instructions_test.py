"""Offline test: per-tenant dynamic instructions (CLAUDE.md S4) -- no key, no network.

The orchestrator's instructions are a callable that injects the calling tenant's
guardrail thresholds, so different businesses get different prompts.

Run:  python -m backend.tests.run_dynamic_instructions_test
"""
from agents import RunContextWrapper

from ..agents.orchestrator import orchestrator_instructions, build_orchestrator
from ..core.context import RunContext
from ..core.tenants import build_tenant_context
from ..testing.fake_model import FakeModel


def _instr(tenant_id: str) -> str:
    ctx = RunContext(tenant=build_tenant_context(tenant_id), sku="SKU-1")
    agent = build_orchestrator(model=FakeModel("x"))
    return orchestrator_instructions(RunContextWrapper(context=ctx), agent)


def main() -> None:
    acme = _instr("acme")
    shop = _instr("cornershop")
    agent = build_orchestrator(model=FakeModel("x"))

    checks = [
        ("acme shows $50,000 PO limit", "$50,000" in acme),
        ("cornershop shows $2,000 PO limit", "$2,000" in shop),
        ("acme markdown cap 50%", "50%" in acme),
        ("cornershop markdown cap 25%", "25%" in shop),
        ("instructions differ per tenant", acme != shop),
        ("base instructions retained", "Inventory Orchestrator" in acme),
        ("orchestrator wires a dynamic callable", callable(agent.instructions)),
    ]

    print("=" * 60)
    print("  DYNAMIC PER-TENANT INSTRUCTIONS (S4)  --  TEST")
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
