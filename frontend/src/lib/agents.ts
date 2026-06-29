import {
  Network,
  TrendingUp,
  PackageCheck,
  ArrowLeftRight,
  BadgePercent,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

/**
 * The Quorum agent roster. Single source of truth for names, identity colors,
 * icons, and the backend wiring (specialist key, action type, approving role).
 * Color classes are written out in full so Tailwind's scanner keeps them.
 */
export type AgentKey =
  | "orchestrator"
  | "forecasting"
  | "reorder"
  | "warehouse"
  | "markdown"
  | "anomaly";

export interface Agent {
  key: AgentKey;
  /** Display name. */
  name: string;
  /** One-line role for marketing + tooltips. */
  tagline: string;
  /** Longer console description. */
  blurb: string;
  icon: LucideIcon;
  /** Role allowed to approve this agent's escalations (matches backend roles). */
  role: string | null;
  /** Tailwind class bundle keyed to the agent's identity color. */
  text: string;
  bg: string;
  ring: string;
  border: string;
  /** Raw CSS variable for charts / inline styling. */
  cssVar: string;
}

export const AGENTS: Record<AgentKey, Agent> = {
  orchestrator: {
    key: "orchestrator",
    name: "Orchestrator",
    tagline: "Coordinates the team",
    blurb:
      "The single brain behind every trigger. Routes work to the right specialist, then explains the plan.",
    icon: Network,
    role: "manager",
    text: "text-orchestrator",
    bg: "bg-orchestrator/10",
    ring: "ring-orchestrator/30",
    border: "border-orchestrator/30",
    cssVar: "var(--color-orchestrator)",
  },
  forecasting: {
    key: "forecasting",
    name: "Horizon",
    tagline: "Predicts demand",
    blurb:
      "Multi-signal demand forecasts per SKU over 7, 30, and 90 days, with a confidence score on every call.",
    icon: TrendingUp,
    role: "planner",
    text: "text-horizon",
    bg: "bg-horizon/10",
    ring: "ring-horizon/30",
    border: "border-horizon/30",
    cssVar: "var(--color-horizon)",
  },
  reorder: {
    key: "reorder",
    name: "Broker",
    tagline: "Handles reorders",
    blurb:
      "Decides what to reorder and how much, drafts the purchase order, and routes spend through approvals.",
    icon: PackageCheck,
    role: "buyer",
    text: "text-broker",
    bg: "bg-broker/10",
    ring: "ring-broker/30",
    border: "border-broker/30",
    cssVar: "var(--color-broker)",
  },
  warehouse: {
    key: "warehouse",
    name: "Router",
    tagline: "Moves stock",
    blurb:
      "Rebalances inventory across fulfillment centers so the right stock sits closest to demand.",
    icon: ArrowLeftRight,
    role: "allocator",
    text: "text-router",
    bg: "bg-router/10",
    ring: "ring-router/30",
    border: "border-router/30",
    cssVar: "var(--color-router)",
  },
  markdown: {
    key: "markdown",
    name: "Tag",
    tagline: "Sets markdowns",
    blurb:
      "Plans price markdowns to clear aging stock, capped by policy and escalated when a cut runs deep.",
    icon: BadgePercent,
    role: "pricer",
    text: "text-tag",
    bg: "bg-tag/10",
    ring: "ring-tag/30",
    border: "border-tag/30",
    cssVar: "var(--color-tag)",
  },
  anomaly: {
    key: "anomaly",
    name: "Sentry",
    tagline: "Catches anomalies",
    blurb:
      "Screens demand and inventory signals around the clock, flagging spikes and gaps before they bite.",
    icon: ShieldAlert,
    role: "analyst",
    text: "text-sentry",
    bg: "bg-sentry/10",
    ring: "ring-sentry/30",
    border: "border-sentry/30",
    cssVar: "var(--color-sentry)",
  },
};

/** Specialists only (excludes the Orchestrator), in display order. */
export const SPECIALISTS: Agent[] = [
  AGENTS.forecasting,
  AGENTS.reorder,
  AGENTS.warehouse,
  AGENTS.markdown,
  AGENTS.anomaly,
];

export const ALL_AGENTS: Agent[] = [AGENTS.orchestrator, ...SPECIALISTS];
