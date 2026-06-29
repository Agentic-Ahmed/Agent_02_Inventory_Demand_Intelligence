"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { BrandMark } from "@/components/brand";
import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";

const ACTIVITY = [
  { agent: AGENTS.forecasting, text: "Forecast SKU-1000, 7d", meta: "94% conf" },
  { agent: AGENTS.reorder, text: "Drafted PO, 1,200 units", meta: "$48.2k" },
  { agent: AGENTS.anomaly, text: "Spike flagged, SKU-2207", meta: "now" },
];

/**
 * A real, miniature version of the Quorum console used as the hero visual.
 * Built from the same primitives and tokens as the product, not a static
 * mockup. Data is illustrative (labeled sample).
 */
export function HeroPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="relative">
      {/* soft brand glow behind the panel */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-primary/10 blur-3xl"
      />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5"
      >
        {/* window bar */}
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <BrandMark className="size-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              acme · operations
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-ok">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
              <span className="relative inline-flex size-2 rounded-full bg-ok" />
            </span>
            Live
          </span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 divide-x divide-border/70 border-b border-border/70">
          {[
            { label: "Forecast acc.", to: 94, suffix: "%" },
            { label: "Stockouts", to: 65, prefix: "-", suffix: "%" },
            { label: "Capital freed", to: 1.2, prefix: "$", suffix: "M", decimals: 1 },
          ].map((k) => (
            <div key={k.label} className="px-4 py-3.5">
              <div className="font-mono text-xl font-semibold tracking-tight text-foreground tabular">
                <CountUp
                  to={k.to}
                  prefix={k.prefix}
                  suffix={k.suffix}
                  decimals={k.decimals ?? 0}
                  duration={1.6}
                />
              </div>
              <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                {k.label}
              </div>
            </div>
          ))}
        </div>

        {/* agent activity */}
        <div className="divide-y divide-border/60">
          {ACTIVITY.map((row, i) => {
            const Icon = row.agent.icon;
            return (
              <motion.div
                key={row.text}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.18 }}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    row.agent.bg,
                  )}
                >
                  <Icon className={cn("size-4", row.agent.text)} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.8rem] text-foreground">
                  <span className={cn("font-medium", row.agent.text)}>
                    {row.agent.name}
                  </span>{" "}
                  {row.text}
                </span>
                <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground tabular">
                  {row.meta}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* approval row */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-4 py-3"
        >
          <div className="min-w-0">
            <div className="truncate text-[0.8rem] font-medium text-foreground">
              PO $48,200 needs approval
            </div>
            <div className="text-[0.7rem] text-muted-foreground">
              over the $10k auto-approve limit
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
              <X className="size-3.5" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Check className="size-3.5" />
            </span>
          </div>
        </motion.div>
      </motion.div>

      <p className="mt-3 text-center text-[0.7rem] text-muted-foreground/70">
        Sample data
      </p>
    </div>
  );
}
