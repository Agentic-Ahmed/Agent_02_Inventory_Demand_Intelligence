"""LIVE test: the approval queue + audit log against the real Neon Postgres.

Requires DATABASE_URL (loaded from backend/.env). Creates rows under a throwaway
tenant, exercises the full contract on Postgres, then DELETES them so the database is
left pristine. This is the one test that is NOT offline -- it proves the prod backend.

Run:  python -m backend.tests.run_postgres_test
"""
import os
import uuid

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from ..api.approval_store import ApprovalStore  # noqa: E402 (after .env load)
from ..api.audit_store import AuditLog  # noqa: E402


def main() -> None:
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL not set — need it in backend/.env")

    tid = "pgtest_" + uuid.uuid4().hex[:6]
    appr = ApprovalStore()   # DATABASE_URL set, no APPROVALS_DB -> Postgres
    audit = AuditLog()
    checks: list[tuple[str, bool]] = [
        ("approvals on postgres", appr.db.postgres is True),
        ("audit on postgres", audit.db.postgres is True),
    ]
    try:
        it = appr.create(tid, "purchase_order", "SKU-PG", "PO needs approval",
                         {"amount": 8000, "specialist": "reorder"}, required_role="buyer")
        checks.append(("create + list", len(appr.list(tid)) == 1))
        checks.append(("detail round-trips", appr.get(it["id"])["detail"]["amount"] == 8000))
        r = appr.resolve(it["id"], "approved", "bianca", note="looks good")
        checks.append(("resolve -> approved", bool(r) and r["status"] == "approved"))
        checks.append(("note merged", r["detail"].get("resolution_note") == "looks good"))
        checks.append(("double-resolve -> None", appr.resolve(it["id"], "rejected", "x") is None))
        checks.append(("pending now 0", len(appr.list(tid)) == 0))

        audit.log(tid, "agent_start", "Orchestrator", "started")
        audit.log(tid, "approval_resolved", "bianca", "approved PO")
        checks.append(("audit list = 2", len(audit.list(tid)) == 2))
    finally:
        appr.db.execute("DELETE FROM approvals WHERE tenant_id=%s", (tid,))
        audit.db.execute("DELETE FROM audit WHERE tenant_id=%s", (tid,))

    checks.append(("cleanup left DB pristine", len(appr.list(tid)) + len(audit.list(tid)) == 0))

    print("=" * 60)
    print("  POSTGRES (Neon) STORES  --  LIVE TEST")
    print("=" * 60)
    for name, ok in checks:
        print(f"  [{'OK ' if ok else 'FAIL'}] {name}")
    print("=" * 60)
    if all(ok for _, ok in checks):
        print(f"  ALL {len(checks)} PASS  (tenant {tid}, rows cleaned up)")
    else:
        raise SystemExit("  FAILED")


if __name__ == "__main__":
    main()
