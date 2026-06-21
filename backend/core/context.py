"""Run context objects injected into tools and guardrails via RunContextWrapper.

Multi-tenancy is non-negotiable (CLAUDE.md S9): every tool/guardrail reads the
tenant from here, and every data access must be scoped by tenant_id.
"""
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class TenantContext:
    """Per-tenant config + guardrail thresholds (blueprint S5 values)."""
    tenant_id: str
    user_role: str = "planner"
    po_auto_approve_limit: float = 10_000.0   # spend guardrail (#1)
    max_markdown: float = 0.40                # markdown depth guardrail (#2)
    min_confidence: float = 0.70              # forecast confidence guardrail (#3)
    max_supplier_share: float = 0.60          # supplier diversity guardrail (#4)
    max_data_age_hours: float = 2.0           # data freshness guardrail (#5)
    hard_po_ceiling: float = 50_000.0         # tool-level hard limit: never auto-execute a PO above this
    hard_markdown_ceiling: float = 0.70       # tool-level hard limit: never apply a markdown deeper than this


@dataclass
class RunContext:
    """The object passed to Runner.run(context=...). Carries the tenant plus the
    current request's data so tools/guardrails can act on it."""
    tenant: TenantContext
    sku: str = ""
    data_age_hours: float = 0.0
    dataset: Optional[Any] = None  # the SKU dataset dict tools read from
