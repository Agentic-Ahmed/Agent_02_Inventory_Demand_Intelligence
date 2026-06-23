"""Offline test for the SQLite-backed approval queue (no API key, no network).

Verifies the store's contract AND the durability that motivated the switch from the
in-memory dict: tenant isolation, JSON detail round-trip, atomic resolve (no
double-resolve), and — the key one — items survive a "restart" (a fresh store
opened on the same DB file still sees them).

Run:  python -m backend.tests.run_approval_store_test
"""
import os
import tempfile

from ..api.approval_store import ApprovalStore


def main() -> None:
    path = os.path.join(tempfile.mkdtemp(prefix="approvals_test_"), "approvals.db")
    checks: list[tuple[str, bool]] = []

    store = ApprovalStore(path)
    a1 = store.create("acme", "purchase_order", "SKU-1000", "PO needs approval",
                      {"amount": 8200, "specialist": "reorder"})
    store.create("acme", "markdown", "SKU-1001", "40%+ markdown")
    store.create("other", "purchase_order", "SKU-2000", "other tenant PO")

    # Tenant isolation
    checks.append(("acme sees 2 pending", len(store.list("acme")) == 2))
    checks.append(("other sees 1 pending", len(store.list("other")) == 1))
    checks.append(("other cannot see acme item", store.list("other") and
                   all(i["tenant_id"] == "other" for i in store.list("other"))))

    # JSON detail round-trips as a dict
    got = store.get(a1["id"])
    checks.append(("detail round-trips", got is not None and got["detail"].get("amount") == 8200))

    # Atomic resolve + no double-resolve
    resolved = store.resolve(a1["id"], "approved", "planner", note="looks good")
    checks.append(("resolve -> approved", resolved is not None and resolved["status"] == "approved"))
    checks.append(("resolve records who", resolved["resolved_by"] == "planner"))
    checks.append(("resolve note merged", resolved["detail"].get("resolution_note") == "looks good"))
    checks.append(("double-resolve -> None", store.resolve(a1["id"], "rejected", "x") is None))
    checks.append(("missing id -> None", store.resolve("deadbeef0000", "approved", "x") is None))
    checks.append(("acme now 1 pending", len(store.list("acme")) == 1))
    checks.append(("acme approved filter", len(store.list("acme", status="approved")) == 1))

    # Durability: a fresh store on the same file (simulated restart) still has it all
    reopened = ApprovalStore(path)
    again = reopened.get(a1["id"])
    checks.append(("survives restart (get)", again is not None and again["status"] == "approved"))
    checks.append(("survives restart (note)", again["detail"].get("resolution_note") == "looks good"))
    checks.append(("survives restart (list)", len(reopened.list("acme", status=None)) == 2))

    print("=" * 60)
    print("  APPROVAL QUEUE (SQLite)  --  DURABILITY + CONTRACT TEST")
    print("=" * 60)
    for name, ok in checks:
        print(f"  [{'OK ' if ok else 'FAIL'}] {name}")
    print("=" * 60)
    if all(ok for _, ok in checks):
        print(f"  ALL {len(checks)} PASS   (db: {path})")
    else:
        raise SystemExit("  FAILED")


if __name__ == "__main__":
    main()
