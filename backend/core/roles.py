"""Team roles and approval authority (CLAUDE.md S8/S9).

Each specialist agent is the digital version of a human job. When an agent
escalates, the decision goes back to the human who owns that job. The Inventory
Manager (the lead) coordinates everything, so they can approve across all agents.
"""
from typing import Optional

PLANNER = "planner"      # owns Forecasting (Horizon)
BUYER = "buyer"          # owns Reorder / Supplier (Broker)
ALLOCATOR = "allocator"  # owns Warehouse Allocation (Router)
PRICER = "pricer"        # owns Markdown / Pricing (Tag)
ANALYST = "analyst"      # owns Anomaly Detection (Sentry)
MANAGER = "manager"      # Inventory Manager (lead): can approve anything
ADMIN = "admin"          # edits the tenant's settings/limits

ROLES = [PLANNER, BUYER, ALLOCATOR, PRICER, ANALYST, MANAGER, ADMIN]

ROLE_LABEL = {
    PLANNER: "Demand Planner",
    BUYER: "Buyer",
    ALLOCATOR: "Allocation Manager",
    PRICER: "Pricing Manager",
    ANALYST: "Analyst",
    MANAGER: "Inventory Manager",
    ADMIN: "Admin",
}

# Which human role owns each specialist agent (= who approves its escalations).
SPECIALIST_ROLE = {
    "forecasting": PLANNER,
    "reorder": BUYER,
    "warehouse": ALLOCATOR,
    "markdown": PRICER,
    "anomaly": ANALYST,
}


def required_role_for(specialist: str) -> Optional[str]:
    """The role that must approve an escalation from this specialist (None = unowned)."""
    return SPECIALIST_ROLE.get(specialist)


def can_approve(user_role: str, required_role: Optional[str]) -> bool:
    """A user may approve if they own the agent that raised it, or if they are the
    Inventory Manager (lead), who can approve across all agents. Unowned items
    (required_role is None) are manager-only."""
    if user_role == MANAGER:
        return True
    if required_role is None:
        return False
    return user_role == required_role


# Roles a teammate can be assigned when invited (Admin is provisioned separately).
INVITABLE_ROLES = [PLANNER, BUYER, ALLOCATOR, PRICER, ANALYST, MANAGER]


def valid_roles(roles) -> list:
    """Keep only known invitable roles, de-duplicated, order preserved."""
    out: list = []
    for r in roles or []:
        if r in INVITABLE_ROLES and r not in out:
            out.append(r)
    return out


def can_approve_any(user_roles, required_role: Optional[str]) -> bool:
    """A teammate may hold several roles (union of approval authority): they can
    approve an item if ANY of their roles can. Mirrors can_approve for a role set."""
    return any(can_approve(r, required_role) for r in (user_roles or []))
