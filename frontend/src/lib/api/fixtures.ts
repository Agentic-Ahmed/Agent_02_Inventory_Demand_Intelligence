/**
 * Seed data for local/preview use, shaped EXACTLY like the FastAPI responses so
 * the console renders without the backend running. When NEXT_PUBLIC_API_BASE is
 * set, the client ignores all of this and calls the real API instead.
 *
 * Two tenants mirror backend/core/tenants.py: "acme" (large) and "cornershop"
 * (small), so the tenant switcher shows real per-tenant differences.
 *
 * NOTE: `dashboard` business KPIs (forecast accuracy, stockout rate, capital
 * freed) and `inventory` health are frontend-seeded — the backend doesn't expose
 * those endpoints yet (it serves usage/approvals/audit/tenant). They're clearly
 * isolated here so they're easy to wire up once those endpoints land.
 */
import type {
  Approval,
  AuditEvent,
  TenantInfo,
  Usage,
} from "./types";

export interface DashboardKpis {
  forecast_accuracy: number; // 0..1 (1 - MAPE)
  forecast_accuracy_delta: number; // vs previous period
  stockout_rate: number; // 0..1
  stockout_rate_delta: number;
  capital_freed: number; // currency, carrying cost reduced
  capital_freed_delta: number;
  reorder_cycle_hours: number;
}

export interface InventoryRow {
  sku: string;
  name: string;
  on_hand: number;
  days_cover: number;
  status: "healthy" | "low" | "critical" | "overstock";
}

interface TenantFixture {
  usage: Usage;
  approvals: Approval[];
  audit: AuditEvent[];
  tenant: TenantInfo;
  dashboard: DashboardKpis;
  inventory: InventoryRow[];
}

const ACME: TenantFixture = {
  usage: {
    tenant_id: "acme",
    agent_runs: 1284,
    total_tokens: 3_410_552,
    tool_calls: 5972,
    escalations: 38,
    approvals_resolved: 31,
    tokens_by_agent: {
      orchestrator: 1_204_330,
      forecasting: 980_110,
      reorder: 540_220,
      warehouse: 320_540,
      markdown: 210_880,
      anomaly: 154_472,
    },
  },
  dashboard: {
    forecast_accuracy: 0.913,
    forecast_accuracy_delta: 0.027,
    stockout_rate: 0.018,
    stockout_rate_delta: -0.041,
    capital_freed: 412_000,
    capital_freed_delta: 86_000,
    reorder_cycle_hours: 3.4,
  },
  inventory: [
    { sku: "SKU-1000", name: "Trailhead Down Jacket", on_hand: 142, days_cover: 11, status: "healthy" },
    { sku: "SKU-1042", name: "Merino Base Layer", on_hand: 28, days_cover: 3, status: "low" },
    { sku: "SKU-1108", name: "Summit 45L Pack", on_hand: 6, days_cover: 1, status: "critical" },
    { sku: "SKU-1190", name: "Cirrus Rain Shell", on_hand: 880, days_cover: 96, status: "overstock" },
    { sku: "SKU-1233", name: "Trail Runner GTX", on_hand: 210, days_cover: 18, status: "healthy" },
  ],
  approvals: [
    {
      id: "apr_ac_01",
      tenant_id: "acme",
      action_type: "purchase_order",
      sku: "SKU-1108",
      summary: "reorder action for SKU-1108 needs human approval (order $62,400 exceeds $50,000 auto-approve)",
      detail: {
        specialist: "reorder",
        order_qty: 1200,
        unit_cost: 52,
        total_cost: 62_400,
        supplier: "Northface Supply Co.",
        supplier_category_share: 0.41,
        reason: "spend_above_auto_approve",
      },
      required_role: "buyer",
      status: "pending",
      created_at: "2026-06-30T09:12:00Z",
      resolved_at: null,
      resolved_by: null,
    },
    {
      id: "apr_ac_02",
      tenant_id: "acme",
      action_type: "markdown",
      sku: "SKU-1190",
      summary: "markdown action for SKU-1190 needs human approval (55% depth exceeds 50% cap)",
      detail: {
        specialist: "markdown",
        markdown_pct: 0.55,
        from_price: 189,
        to_price: 85,
        weeks_of_overstock: 14,
        reason: "markdown_above_cap",
      },
      required_role: "pricer",
      status: "pending",
      created_at: "2026-06-30T08:40:00Z",
      resolved_at: null,
      resolved_by: null,
    },
    {
      id: "apr_ac_03",
      tenant_id: "acme",
      action_type: "anomaly",
      sku: "SKU-1042",
      summary: "anomaly action for SKU-1042 needs human approval (high-severity demand spike)",
      detail: {
        specialist: "anomaly",
        anomaly_type: "demand_spike",
        severity: "high",
        observed: 412,
        expected: 90,
        reason: "high_severity_anomaly",
      },
      required_role: "analyst",
      status: "pending",
      created_at: "2026-06-30T07:55:00Z",
      resolved_at: null,
      resolved_by: null,
    },
    {
      id: "apr_ac_04",
      tenant_id: "acme",
      action_type: "stock_transfer",
      sku: "SKU-1000",
      summary: "warehouse action for SKU-1000 needs human approval (transfer drops source below safety stock)",
      detail: {
        specialist: "warehouse",
        from_warehouse: "DC-East",
        to_warehouse: "DC-West",
        qty: 60,
        reason: "stock_safety",
      },
      required_role: "allocator",
      status: "approved",
      created_at: "2026-06-29T16:20:00Z",
      resolved_at: "2026-06-29T16:48:00Z",
      resolved_by: "Alan",
    },
    {
      id: "apr_ac_05",
      tenant_id: "acme",
      action_type: "forecast_review",
      sku: "SKU-1233",
      summary: "forecasting action for SKU-1233 needs human approval (confidence 0.54 below 0.60)",
      detail: {
        specialist: "forecasting",
        predicted_units: 320,
        confidence: 0.54,
        horizon_days: 30,
        reason: "low_confidence",
      },
      required_role: "planner",
      status: "rejected",
      created_at: "2026-06-29T11:05:00Z",
      resolved_at: "2026-06-29T11:31:00Z",
      resolved_by: "Pat",
    },
  ],
  audit: [
    {
      id: "ev_ac_01",
      tenant_id: "acme",
      ts: "2026-06-30T09:12:03Z",
      event_type: "escalation",
      actor: "reorder",
      summary: "reorder action for SKU-1108 needs human approval (order $62,400 exceeds $50,000 auto-approve)",
      detail: { approval_id: "apr_ac_01", sku: "SKU-1108", reason: "spend_above_auto_approve" },
    },
    {
      id: "ev_ac_02",
      tenant_id: "acme",
      ts: "2026-06-30T09:11:58Z",
      event_type: "tool_call",
      actor: "orchestrator",
      summary: "decide_reorder(SKU-1108)",
      detail: { tool: "decide_reorder", sku: "SKU-1108" },
    },
    {
      id: "ev_ac_03",
      tenant_id: "acme",
      ts: "2026-06-30T09:11:40Z",
      event_type: "agent_run",
      actor: "orchestrator",
      summary: "hourly run for SKU-1108: check anomalies, forecast demand, decide reorder",
      detail: { trigger: "scheduled" },
    },
    {
      id: "ev_ac_04",
      tenant_id: "acme",
      ts: "2026-06-29T16:48:11Z",
      event_type: "approval_resolved",
      actor: "Alan",
      summary: "approved stock_transfer for SKU-1000",
      detail: { approval_id: "apr_ac_04", status: "approved", role: "allocator" },
    },
    {
      id: "ev_ac_05",
      tenant_id: "acme",
      ts: "2026-06-29T11:31:09Z",
      event_type: "approval_resolved",
      actor: "Pat",
      summary: "rejected forecast_review for SKU-1233",
      detail: { approval_id: "apr_ac_05", status: "rejected", role: "planner" },
    },
  ],
  tenant: {
    tenant_id: "acme",
    name: "Acme Retail (large)",
    thresholds: {
      po_auto_approve_limit: 50_000,
      max_markdown: 0.5,
      min_confidence: 0.6,
      max_supplier_share: 0.6,
      hard_po_ceiling: 250_000,
      hard_markdown_ceiling: 0.7,
    },
    team: {
      planner: { label: "Demand Planner", person: "Pat" },
      buyer: { label: "Buyer", person: "Bianca" },
      allocator: { label: "Allocation Manager", person: "Alan" },
      pricer: { label: "Pricing Manager", person: "Priya" },
      analyst: { label: "Analyst", person: "Ana" },
      manager: { label: "Inventory Manager", person: "Maya" },
      admin: { label: "Admin", person: "Adam" },
    },
    you: { role: "planner", label: "Demand Planner", can_approve: ["forecasting"] },
  },
};

const CORNERSHOP: TenantFixture = {
  usage: {
    tenant_id: "cornershop",
    agent_runs: 196,
    total_tokens: 412_880,
    tool_calls: 731,
    escalations: 9,
    approvals_resolved: 7,
    tokens_by_agent: {
      orchestrator: 168_220,
      forecasting: 121_010,
      reorder: 58_400,
      warehouse: 21_900,
      markdown: 26_650,
      anomaly: 16_700,
    },
  },
  dashboard: {
    forecast_accuracy: 0.864,
    forecast_accuracy_delta: 0.012,
    stockout_rate: 0.046,
    stockout_rate_delta: -0.018,
    capital_freed: 28_400,
    capital_freed_delta: 5_200,
    reorder_cycle_hours: 3.9,
  },
  inventory: [
    { sku: "SKU-2001", name: "Cold Brew 12-pack", on_hand: 64, days_cover: 9, status: "healthy" },
    { sku: "SKU-2014", name: "Oat Milk 1L", on_hand: 12, days_cover: 2, status: "low" },
    { sku: "SKU-2030", name: "Seasonal Roast 1kg", on_hand: 3, days_cover: 1, status: "critical" },
  ],
  approvals: [
    {
      id: "apr_cs_01",
      tenant_id: "cornershop",
      action_type: "purchase_order",
      sku: "SKU-2030",
      summary: "reorder action for SKU-2030 needs human approval (order $2,640 exceeds $2,000 auto-approve)",
      detail: {
        specialist: "reorder",
        order_qty: 120,
        unit_cost: 22,
        total_cost: 2_640,
        supplier: "Highland Roasters",
        supplier_category_share: 0.72,
        reason: "spend_above_auto_approve",
      },
      required_role: "buyer",
      status: "pending",
      created_at: "2026-06-30T08:05:00Z",
      resolved_at: null,
      resolved_by: null,
    },
    {
      id: "apr_cs_02",
      tenant_id: "cornershop",
      action_type: "forecast_review",
      sku: "SKU-2014",
      summary: "forecasting action for SKU-2014 needs human approval (confidence 0.73 below 0.80)",
      detail: {
        specialist: "forecasting",
        predicted_units: 40,
        confidence: 0.73,
        horizon_days: 7,
        reason: "low_confidence",
      },
      required_role: "planner",
      status: "pending",
      created_at: "2026-06-30T07:30:00Z",
      resolved_at: null,
      resolved_by: null,
    },
  ],
  audit: [
    {
      id: "ev_cs_01",
      tenant_id: "cornershop",
      ts: "2026-06-30T08:05:02Z",
      event_type: "escalation",
      actor: "reorder",
      summary: "reorder action for SKU-2030 needs human approval (order $2,640 exceeds $2,000 auto-approve)",
      detail: { approval_id: "apr_cs_01", sku: "SKU-2030", reason: "spend_above_auto_approve" },
    },
    {
      id: "ev_cs_02",
      tenant_id: "cornershop",
      ts: "2026-06-30T07:30:14Z",
      event_type: "escalation",
      actor: "forecasting",
      summary: "forecasting action for SKU-2014 needs human approval (confidence 0.73 below 0.80)",
      detail: { approval_id: "apr_cs_02", sku: "SKU-2014", reason: "low_confidence" },
    },
  ],
  tenant: {
    tenant_id: "cornershop",
    name: "Corner Shop (small)",
    thresholds: {
      po_auto_approve_limit: 2_000,
      max_markdown: 0.25,
      min_confidence: 0.8,
      max_supplier_share: 0.8,
      hard_po_ceiling: 10_000,
      hard_markdown_ceiling: 0.6,
    },
    team: {
      planner: { label: "Demand Planner", person: "Sam" },
      buyer: { label: "Buyer", person: "Sam" },
      allocator: { label: "Allocation Manager", person: "Sam" },
      pricer: { label: "Pricing Manager", person: "Sam" },
      analyst: { label: "Analyst", person: "Sam" },
      manager: { label: "Inventory Manager", person: "Sam" },
      admin: { label: "Admin", person: "Sam" },
    },
    you: { role: "planner", label: "Demand Planner", can_approve: ["forecasting"] },
  },
};

export const FIXTURES: Record<string, TenantFixture> = {
  acme: ACME,
  cornershop: CORNERSHOP,
};

export function tenantFixture(tenantId: string): TenantFixture {
  return FIXTURES[tenantId] ?? ACME;
}
