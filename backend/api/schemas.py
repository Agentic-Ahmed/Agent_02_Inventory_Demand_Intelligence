"""Request/response models for the FastAPI layer (CLAUDE.md S10 /api)."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(description="Natural-language request to the orchestrator")
    sku: str = Field(default="SKU-1000", description="SKU the request is about")


class ChatResponse(BaseModel):
    answer: str
    tools_called: list[str] = Field(default_factory=list)
    escalations: list[str] = Field(default_factory=list, description="IDs of approval items created this turn")


class ApprovalOut(BaseModel):
    id: str
    tenant_id: str
    action_type: str
    sku: str
    summary: str
    detail: dict[str, Any] = Field(default_factory=dict)
    required_role: Optional[str] = Field(default=None, description="Role that may approve this item")
    status: str
    created_at: str
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None


class ApprovalAction(BaseModel):
    action: Literal["approve", "reject"]
    by: str = Field(default="planner", description="User resolving the item")
    note: str = ""


class TriggerRequest(BaseModel):
    type: Literal["scheduled", "event"]
    sku: str = "SKU-1000"
    reason: str = Field(default="", description="e.g. 'hourly run' or 'flash-sale spike'")


class TriggerResponse(BaseModel):
    accepted: bool
    type: str
    sku: str
    answer: Optional[str] = None
    escalations: list[str] = Field(default_factory=list)


class AuditOut(BaseModel):
    id: str
    tenant_id: str
    ts: str
    event_type: str
    actor: str = ""
    summary: str = ""
    detail: dict[str, Any] = Field(default_factory=dict)


class UsageOut(BaseModel):
    tenant_id: str
    agent_runs: int = 0
    total_tokens: int = 0
    tool_calls: int = 0
    escalations: int = 0
    approvals_resolved: int = 0
    tokens_by_agent: dict[str, int] = Field(default_factory=dict)


class InviteCreate(BaseModel):
    email: str = Field(description="Teammate's email address")
    roles: list[str] = Field(
        default_factory=list,
        description="App roles to assign — a teammate may hold several (union of authority)",
    )


class InviteOut(BaseModel):
    id: str
    tenant_id: str
    email: str
    roles: list[str] = Field(default_factory=list)
    invited_by: str = ""
    status: str
    created_at: str
    revoked_at: Optional[str] = None


class MemoryAdd(BaseModel):
    text: str = Field(description="Knowledge to remember (a fact, policy, or note)")
    kind: str = Field(default="note", description="Category tag, e.g. note / policy / decision")


class MemoryOut(BaseModel):
    id: str
    kind: str


class MemoryHit(BaseModel):
    text: str
    kind: Optional[str] = None
    score: float


class MemorySearchOut(BaseModel):
    query: str
    hits: list[MemoryHit] = Field(default_factory=list)


class EventIn(BaseModel):
    type: str = Field(default="flash_sale", description="e.g. flash_sale / supplier_delay / stockout_risk")
    sku: str = Field(default="SKU-1000")
    reason: str = Field(default="", description="Human-readable trigger reason")
    magnitude: Optional[float] = Field(default=None, description="Optional size of the event, e.g. demand multiplier")


class EventPublishOut(BaseModel):
    published: bool
    topic: str
    key: str


class DrainResult(BaseModel):
    tenant_id: str
    sku: str
    reason: str
    answer: str = ""
    escalations: list[str] = Field(default_factory=list)
    error: Optional[str] = None


class DrainOut(BaseModel):
    processed: int
    results: list[DrainResult] = Field(default_factory=list)
