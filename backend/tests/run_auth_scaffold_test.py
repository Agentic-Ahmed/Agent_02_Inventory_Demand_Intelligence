"""Offline test for the Clerk auth scaffold (no keys, no network).

Verifies the swap-in design:
  - Clerk org claims map correctly to our {tenant, role},
  - with Clerk OFF (no env) the dev headers still drive everything (nothing breaks),
  - with Clerk simulated ON, a request maps to the token's {org, role}, and a request
    with no token is rejected 401.
The real RS256/JWKS signature check is validated live once CLERK_* keys are set.

Run:  python -m backend.tests.run_auth_scaffold_test
"""
from fastapi.testclient import TestClient

from ..core import auth
from ..api.app import app


def main() -> None:
    checks: list[tuple[str, bool]] = []

    # 1. role mapping
    checks.append(("org:buyer -> buyer", auth.map_clerk_role("org:buyer") == "buyer"))
    checks.append(("org:admin -> admin", auth.map_clerk_role("org:admin") == "admin"))
    checks.append(("org:owner -> manager", auth.map_clerk_role("org:owner") == "manager"))
    checks.append(("unknown -> planner", auth.map_clerk_role("org:whatever") == "planner"))
    checks.append(("none -> planner", auth.map_clerk_role(None) == "planner"))

    # 2. identity from claims
    checks.append(("identity slug+role",
                   auth.identity_from_claims({"org_slug": "acme", "org_role": "org:pricer"}) == ("acme", "pricer")))
    checks.append(("identity falls back to org_id + planner",
                   auth.identity_from_claims({"org_id": "org_123"}) == ("org_123", "planner")))

    # 3. Clerk OFF by default -> dev headers honored
    checks.append(("clerk disabled w/o env", auth.clerk_enabled() is False))
    client = TestClient(app)
    r = client.get("/api/tenant", headers={"X-Tenant-Id": "acme", "X-User-Role": "buyer"})
    checks.append(("dev headers honored", r.status_code == 200 and r.json()["you"]["role"] == "buyer"))

    # 4. simulate Clerk ON (monkeypatch verify) -> token drives identity; no token -> 401
    orig_enabled, orig_verify = auth.clerk_enabled, auth.verify_clerk_token
    try:
        auth.clerk_enabled = lambda: True
        auth.verify_clerk_token = lambda token: {"org_slug": "cornershop", "org_role": "org:manager"}
        r_ok = client.get("/api/tenant", headers={"Authorization": "Bearer faketoken"})
        checks.append(("clerk token -> org+role",
                       r_ok.status_code == 200
                       and r_ok.json()["tenant_id"] == "cornershop"
                       and r_ok.json()["you"]["role"] == "manager"))
        checks.append(("no token -> 401", client.get("/api/tenant").status_code == 401))
    finally:
        auth.clerk_enabled, auth.verify_clerk_token = orig_enabled, orig_verify

    print("=" * 60)
    print("  CLERK AUTH SCAFFOLD  --  SWAP-IN TEST (offline)")
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
