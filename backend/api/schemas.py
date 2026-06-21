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
