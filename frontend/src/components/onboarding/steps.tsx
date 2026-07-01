"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Network,
  Workflow,
  ShieldCheck,
  Inbox,
  Gauge,
  BadgePercent,
  LayoutDashboard,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

import { ALL_AGENTS } from "@/lib/agents";
import { cn } from "@/lib/utils";

/**
 * The four walkthrough panels. Each is a focused, presentational step body;
 * navigation, progress, and persistence live in <Walkthrough/>. Identity colors
 * for the agent grid come from lib/agents.ts (single source of truth).
 */

export interface StepMeta {
  id: string;
  /** Short label for the progress rail. */
  label: string;
  eyebrow: string;
  title: string;
}

export const STEPS: StepMeta[] = [
  { id: "welcome", label: "Welcome", eyebrow: "Welcome to Quorum", title: "Six agents run your inventory. You run the calls that matter." },
  { id: "agents", label: "The team", eyebrow: "Your quorum", title: "Meet the six agents on the floor." },
  { id: "control", label: "Control", eyebrow: "Guardrails", title: "Full autonomy, with a seatbelt." },
  { id: "ready", label: "You're set", eyebrow: "You're in", title: "Your quorum is ready." },
];

// Shared in/out motion for the panel body; static under prefers-reduced-motion.
function useStepMotion() {
  const reduce = useReducedMotion();
  return reduce
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
      };
}

export function WelcomeStep() {
  const m = useStepMotion();
  const points: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Workflow, title: "It works on its own", body: "Forecasts demand, reorders stock, rebalances warehouses, and prices markdowns — triggered hourly or by live sales events." },
    { icon: Network, title: "One orchestrator, five specialists", body: "A single brain routes each decision to the right specialist agent, then explains the plan in plain language." },
    { icon: ShieldCheck, title: "You stay in control", body: "Every move that spends real money or cuts price deep stops for your approval. Nothing risky runs unattended." },
  ];
  return (
    <motion.div {...m} className="grid gap-3">
      {points.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex items-start gap-3.5 rounded-xl border border-border/70 bg-card/50 p-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

export function AgentsStep() {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ALL_AGENTS.map((agent, i) => {
        const Icon = agent.icon;
        return (
          <motion.div
            key={agent.key}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className={cn("flex items-start gap-3 rounded-xl border bg-card/50 p-3.5", agent.border)}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", agent.bg, agent.text)}>
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                <span className={cn("truncate text-xs font-medium", agent.text)}>{agent.tagline}</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{agent.blurb}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function ControlStep() {
  const m = useStepMotion();
  const limits: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Gauge, label: "Purchase orders auto-approve under", value: "$10,000" },
    { icon: BadgePercent, label: "Markdowns need sign-off beyond", value: "40% off" },
    { icon: ShieldCheck, label: "Low-confidence forecasts route to", value: "human review" },
  ];
  return (
    <motion.div {...m} className="grid gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Agents act inside thresholds you set per business. Cross one and the action doesn&apos;t
        execute — it parks in your approval inbox with the full reasoning attached.
      </p>
      <div className="grid gap-2.5">
        {limits.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/50 px-4 py-3">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Inbox className="size-4" />
        </span>
        <p className="text-sm text-foreground">
          <span className="font-semibold">Your approval inbox</span> is where the money calls land —
          approve, reject, or modify, every action audited.
        </p>
      </div>
    </motion.div>
  );
}

export function ReadyStep() {
  const m = useStepMotion();
  const spots: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: LayoutDashboard, title: "Dashboard", body: "Forecast accuracy, stockout rate, and capital freed — your inventory health at a glance." },
    { icon: Inbox, title: "Approval inbox", body: "Where the money calls wait for you — approve, reject, or modify, every action audited." },
    { icon: MessagesSquare, title: "Ask the orchestrator", body: "Ask about any SKU, forecast, or decision in plain language and get a reasoned answer back." },
  ];
  return (
    <motion.div {...m} className="grid gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        That&apos;s the tour. Your workspace is set up and isolated to your business —
        here&apos;s where to start.
      </p>
      <div className="grid gap-2.5">
        {spots.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3.5 rounded-xl border border-border/70 bg-card/50 p-4">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
