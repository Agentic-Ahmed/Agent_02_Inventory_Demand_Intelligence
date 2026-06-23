"""Lifecycle hooks that write the audit trail (CLAUDE.md S4 lifecycle hooks).

Passed to Runner.run / run_streamed; the SDK invokes these as the orchestrator runs,
so every agent run and specialist tool call + result lands in the audit log, scoped to
the tenant from the run context. Token usage is captured on agent end for per-tenant
metering/billing (CLAUDE.md S3 include_usage).
"""
from agents import RunHooks

from ..api.audit_store import AUDIT


class AuditHooks(RunHooks):
    def __init__(self, tenant_id: str, sku: str = "", store=AUDIT):
        self.tenant_id = tenant_id
        self.sku = sku
        self.store = store

    def _tenant(self, context) -> str:
        ctx = getattr(context, "context", None)
        tenant = getattr(ctx, "tenant", None)
        return getattr(tenant, "tenant_id", None) or self.tenant_id

    async def on_agent_start(self, context, agent) -> None:
        name = getattr(agent, "name", "agent")
        self.store.log(self._tenant(context), "agent_start", name, f"{name} started", {"sku": self.sku})

    async def on_agent_end(self, context, agent, output) -> None:
        name = getattr(agent, "name", "agent")
        usage = getattr(context, "usage", None)
        tokens = getattr(usage, "total_tokens", None)
        self.store.log(self._tenant(context), "agent_end", name, f"{name} finished",
                       {"sku": self.sku, "total_tokens": tokens})

    async def on_tool_start(self, context, agent, tool) -> None:
        name = getattr(tool, "name", "tool")
        self.store.log(self._tenant(context), "tool_call", name, f"calling {name}", {"sku": self.sku})

    async def on_tool_end(self, context, agent, tool, result) -> None:
        name = getattr(tool, "name", "tool")
        d = result if isinstance(result, dict) else {}
        status, spec = d.get("status"), d.get("specialist")
        self.store.log(self._tenant(context), "tool_result", name,
                       f"{spec or name}: {status or 'ok'}",
                       {"sku": self.sku, "status": status, "specialist": spec})
