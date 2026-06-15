"""Pydantic schemas for structured agent outputs (CLAUDE.md S4: structured outputs).

Using a typed output_type means the SDK validates every agent response against
the schema — no free-text parsing.
"""
from pydantic import BaseModel, Field


class Forecast(BaseModel):
    """SKU-level demand forecast produced by the Demand Forecasting Agent."""
    sku: str = Field(description="The SKU being forecast")
    horizon_days: int = Field(description="Forecast horizon in days (7, 30, or 90)")
    predicted_units: int = Field(ge=0, description="Predicted total units over the horizon")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score in [0,1]")
    reasoning: str = Field(default="", description="Brief explanation of the forecast")


class SupplierQuote(BaseModel):
    """A supplier's quote for a reorder."""
    supplier_id: str
    unit_price: float = Field(ge=0)
    lead_time_days: int = Field(ge=0)
    category_share: float = Field(ge=0.0, le=1.0, description="Supplier's share of category spend")


class ReorderDecision(BaseModel):
    """Reorder recommendation produced by the Reorder & Supplier Agent."""
    sku: str
    reorder_qty: int = Field(ge=0, description="Units to reorder (0 = no action needed)")
    supplier_id: str = Field(default="", description="Chosen supplier")
    unit_cost: float = Field(ge=0.0, description="Unit price from the chosen supplier")
    total_cost: float = Field(ge=0.0, description="reorder_qty * unit_cost")
    supplier_category_share: float = Field(
        ge=0.0, le=1.0, description="Chosen supplier's share of category spend"
    )
    reasoning: str = Field(default="", description="Brief explanation of the decision")
