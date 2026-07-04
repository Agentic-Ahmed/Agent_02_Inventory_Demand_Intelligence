/**
 * Assignable teammate roles — a mirror of backend/core/roles.INVITABLE_ROLES,
 * enriched with what each role owns and is allowed to approve. Used by the Invite
 * Teammate walkthrough's role picker and its permissions explainer.
 */
import type { TenantThresholds } from "./api/types";

export interface RoleMeta {
  key: string;
  label: string;
  owns: string; // the area / agent this role owns
  blurb: string; // one-line description shown in the picker
}

export const INVITABLE_ROLES: RoleMeta[] = [
  { key: "planner", label: "Demand Planner", owns: "Forecasting", blurb: "Reviews low-confidence forecasts." },
  { key: "buyer", label: "Buyer", owns: "Reorder & suppliers", blurb: "Signs off purchase orders." },
  { key: "allocator", label: "Allocation Manager", owns: "Warehouse", blurb: "Approves stock transfers." },
  { key: "pricer", label: "Pricing Manager", owns: "Markdowns", blurb: "Approves price markdowns." },
  { key: "analyst", label: "Analyst", owns: "Anomaly detection", blurb: "Reviews flagged anomalies." },
  { key: "manager", label: "Inventory Manager", owns: "Everything", blurb: "Can approve anything — the lead override." },
];

export const ROLE_META: Record<string, RoleMeta> = Object.fromEntries(
  INVITABLE_ROLES.map((r) => [r.key, r]),
);

const pct = (n: number) => `${Math.round(n * 100)}%`;
const money = (n: number) => `$${n.toLocaleString()}`;

/**
 * What a set of roles will be able to approve, phrased with this tenant's limits.
 * Returns human sentences for the permissions step. Manager short-circuits to the
 * lead override. Thresholds are optional (fall back to generic phrasing).
 */
export function approvalSummary(roles: string[], t?: TenantThresholds): string[] {
  const set = new Set(roles);
  if (set.has("manager")) {
    return ["Approve anything across all agents — the Inventory Manager (lead) override."];
  }
  const out: string[] = [];
  if (set.has("buyer"))
    out.push(
      t
        ? `Sign off purchase orders, including any reorder above your ${money(t.po_auto_approve_limit)} auto-approve limit.`
        : "Sign off purchase orders and reorders.",
    );
  if (set.has("pricer"))
    out.push(t ? `Approve markdowns deeper than ${pct(t.max_markdown)}.` : "Approve price markdowns.");
  if (set.has("planner"))
    out.push(t ? `Review forecasts below ${pct(t.min_confidence)} confidence.` : "Review low-confidence forecasts.");
  if (set.has("allocator")) out.push("Approve stock transfers between fulfillment centers.");
  if (set.has("analyst")) out.push("Review anomalies flagged for a human.");
  return out;
}
