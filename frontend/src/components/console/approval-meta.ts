import {
  PackageCheck,
  BadgePercent,
  ArrowLeftRight,
  TrendingUp,
  ShieldAlert,
  FileCheck,
  type LucideIcon,
} from "lucide-react";

import type { ActionType, ApprovalStatus } from "@/lib/api/types";
import { AGENTS, type AgentKey } from "@/lib/agents";
import { currency, num, pct } from "@/lib/format";

/** Maps each escalation action type to a label, icon, and the agent that raises it
 *  (so items can carry that agent's identity color). Mirrors orchestration._ACTION_TYPE. */
export const ACTION_META: Record<
  ActionType,
  { label: string; icon: LucideIcon; agent: AgentKey | null }
> = {
  purchase_order: { label: "Purchase order", icon: PackageCheck, agent: "reorder" },
  markdown: { label: "Markdown", icon: BadgePercent, agent: "markdown" },
  stock_transfer: { label: "Stock transfer", icon: ArrowLeftRight, agent: "warehouse" },
  forecast_review: { label: "Forecast review", icon: TrendingUp, agent: "forecasting" },
  anomaly: { label: "Anomaly", icon: ShieldAlert, agent: "anomaly" },
  review: { label: "Review", icon: FileCheck, agent: null },
};

export function actionAgentColors(action: ActionType) {
  const agent = ACTION_META[action]?.agent;
  if (!agent) return { bg: "bg-muted", text: "text-muted-foreground" };
  return { bg: AGENTS[agent].bg, text: AGENTS[agent].text };
}

/** Status pill styling for an approval. */
export const STATUS_STYLE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warn/10 text-warn" },
  approved: { label: "Approved", className: "bg-ok/10 text-ok" },
  rejected: { label: "Rejected", className: "bg-critical/10 text-critical" },
};

// ---- detail rendering ----

/** Human sentence for why a guardrail tripped (detail.reason). */
const REASON_LABEL: Record<string, string> = {
  spend_above_auto_approve: "Spend above the auto-approve limit",
  markdown_above_cap: "Markdown deeper than the policy cap",
  low_confidence: "Forecast confidence below threshold",
  high_severity_anomaly: "High-severity anomaly detected",
  stock_safety: "Would drop the source below safety stock",
};

/** "demand_spike" -> "Demand spike", "DC-East" -> "DC-East". */
function humanize(s: string): string {
  if (!s.includes("_")) return s;
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(key: string, value: unknown): string {
  if (typeof value === "number") {
    if (/cost|price/.test(key)) return currency(value);
    if (/pct|confidence|share/.test(key)) return pct(value);
    return num(value);
  }
  if (typeof value === "string") return humanize(value);
  return String(value);
}

export interface DetailFact {
  label: string;
  value: string;
}

// Rendered separately (as the trigger reason / via the action agent), so hidden here.
const HIDDEN_DETAIL_KEYS = new Set(["specialist", "reason"]);

/** The escalation's detail payload as labeled facts, formatted by key heuristics. */
export function describeDetail(detail: Record<string, unknown>): DetailFact[] {
  return Object.entries(detail)
    .filter(([k, v]) => !HIDDEN_DETAIL_KEYS.has(k) && v !== null && v !== undefined)
    .map(([k, v]) => ({ label: humanize(k), value: formatValue(k, v) }));
}

export function detailReason(detail: Record<string, unknown>): string | null {
  const r = detail.reason;
  if (typeof r !== "string") return null;
  return REASON_LABEL[r] ?? humanize(r);
}
