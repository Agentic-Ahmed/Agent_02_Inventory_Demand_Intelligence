"""Synthetic tenant registry for dev (CLAUDE.md S9).

Each tenant (a business) has its OWN guardrail thresholds and a TEAM of users
(one per role). In prod these come from the per-tenant Settings screen + database
(row-level security); here they're seeded so per-tenant behaviour is testable:
the same $8k order auto-approves for the big retailer but escalates for the small shop.
"""
from .context import TenantContext
from .roles import PLANNER, BUYER, ALLOCATOR, PRICER, ANALYST, MANAGER, ADMIN

# tenant_id -> {name, thresholds (subset of TenantContext fields), team {role: person}}
TENANTS: dict[str, dict] = {
    "acme": {
        "name": "Acme Retail (large)",
        "thresholds": {
            "po_auto_approve_limit": 50_000.0,
            "max_markdown": 0.50,
            "min_confidence": 0.60,
            "max_supplier_share": 0.60,
            "hard_po_ceiling": 250_000.0,
            "hard_markdown_ceiling": 0.70,
        },
        "team": {
            PLANNER: "Pat", BUYER: "Bianca", ALLOCATOR: "Alan", PRICER: "Priya",
            ANALYST: "Ana", MANAGER: "Maya", ADMIN: "Adam",
        },
    },
    "cornershop": {
        "name": "Corner Shop (small)",
        "thresholds": {
            "po_auto_approve_limit": 2_000.0,
            "max_markdown": 0.25,
            "min_confidence": 0.80,
            "max_supplier_share": 0.80,
            "hard_po_ceiling": 10_000.0,
            "hard_markdown_ceiling": 0.60,
        },
        # A tiny shop: the owner wears every hat.
        "team": {
            PLANNER: "Sam", BUYER: "Sam", ALLOCATOR: "Sam", PRICER: "Sam",
            ANALYST: "Sam", MANAGER: "Sam", ADMIN: "Sam",
        },
    },
}

DEFAULT_TENANT = "acme"


def tenant_config(tenant_id: str) -> dict:
    """Raw registry entry for a tenant ({} if unknown)."""
    return TENANTS.get(tenant_id, {})


def build_tenant_context(tenant_id: str, user_role: str = PLANNER) -> TenantContext:
    """Per-request TenantContext: the tenant's own thresholds + the caller's role.
    Unknown tenants fall back to TenantContext defaults (so tests/ad-hoc ids work)."""
    thresholds = TENANTS.get(tenant_id, {}).get("thresholds", {})
    return TenantContext(tenant_id=tenant_id, user_role=user_role, **thresholds)
