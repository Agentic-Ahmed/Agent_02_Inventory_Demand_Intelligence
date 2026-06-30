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
