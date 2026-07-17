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
    email_sent: bool = Field(default=False, description="A real Clerk invitation email was delivered")
    email_error: Optional[str] = Field(default=None, description="Why delivery failed, if it did")


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


class DashboardKpis(BaseModel):
    """GET /api/dashboard -- headline KPIs for the console dashboard."""
    forecast_accuracy: float = 0.0
    forecast_accuracy_delta: float = 0.0
    forecast_accuracy_trend: list[float] = Field(default_factory=list)
    stockout_rate: float = 0.0
    stockout_rate_delta: float = 0.0
    stockout_rate_trend: list[float] = Field(default_factory=list)
    capital_freed: float = 0.0
    capital_freed_delta: float = 0.0
    capital_freed_trend: list[float] = Field(default_factory=list)
    reorder_cycle_hours: float = 0.0
    reorder_cycle_trend: list[float] = Field(default_factory=list)


class InventoryRow(BaseModel):
    """GET /api/inventory -- one SKU's stock health."""
    sku: str
    name: str
    on_hand: int
    days_cover: int
    status: Literal["healthy", "low", "critical", "overstock"]


class ForecastPoint(BaseModel):
    day: int
    mean: float
    lower: float
    upper: float


class ForecastHorizon(BaseModel):
    days: int
    points: list[ForecastPoint] = Field(default_factory=list)
    predicted_total: int
    daily_mean: float
    confidence: float
    projected_stockout_day: Optional[int] = None


class SkuForecast(BaseModel):
    """GET /api/forecasts -- per-SKU demand forecast across 7/30/90-day horizons."""
    sku: str
    name: str
    status: str
    on_hand: int
    history: list[int] = Field(default_factory=list)
    horizons: dict[str, ForecastHorizon] = Field(default_factory=dict)  # keys "7"/"30"/"90"


class IntegrationConnect(BaseModel):
    """POST /api/integrations body: connect a tenant's own system."""
    kind: str = Field(description="wms | erp | commerce | warehouse_data | slack | events")
    label: str = ""
    config: dict[str, Any] = Field(default_factory=dict, description="Non-secret settings, e.g. endpoint URL")
    secret: Optional[str] = Field(default=None, description="Credential — stored masked, never returned")


class IntegrationOut(BaseModel):
    id: str
    tenant_id: str
    kind: str
    label: str = ""
    config: dict[str, Any] = Field(default_factory=dict)
    secret_hint: Optional[str] = None
    status: str
    created_at: str
    updated_at: str


class ImportRow(BaseModel):
    sku: str
    name: str = ""
    on_hand: int = 0
    days_cover: int = 0
    status: Optional[str] = None


class InventoryImport(BaseModel):
    """POST /api/inventory/import body: a tenant's inventory rows (from a CSV upload)."""
    rows: list[ImportRow] = Field(default_factory=list)


class ImportResult(BaseModel):
    imported: int
    source: str = "import"


class TenantThresholdsPatch(BaseModel):
    """Partial guardrail-threshold edit — every field optional (only send what changed)."""
    po_auto_approve_limit: Optional[float] = None
    max_markdown: Optional[float] = None
    min_confidence: Optional[float] = None
    max_supplier_share: Optional[float] = None
    hard_po_ceiling: Optional[float] = None
    hard_markdown_ceiling: Optional[float] = None


class TenantPatch(BaseModel):
    """PATCH /api/tenant body: rename the workspace, adjust guardrail thresholds, and/or
    set the weather-signal location (send both lat+lon to set it, or reset to default)."""
    name: Optional[str] = None
    thresholds: Optional[TenantThresholdsPatch] = None
    signal_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    signal_longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    signal_location_label: Optional[str] = Field(
        default=None, description="Human label for the saved location, e.g. 'London, GB'")
    reset_signal_location: bool = Field(
        default=False, description="Clear a saved location and fall back to the default")


class GeocodeHit(BaseModel):
    name: Optional[str] = None
    admin1: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class GeocodeOut(BaseModel):
    query: str
    results: list[GeocodeHit] = Field(default_factory=list)


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
