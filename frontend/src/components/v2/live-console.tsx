"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { AGENTS, type AgentKey } from "@/lib/agents";
import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";

type Row = { id: number; agentKey: AgentKey; text: string; meta: string };

const POOL: ((sku: number) => Omit<Row, "id">)[] = [
  (s) => ({ agentKey: "forecasting", text: `Forecast SKU-${s}, 7-day`, meta: `${90 + (s % 9)}% conf` }),
  (s) => ({ agentKey: "reorder", text: `Drafted PO, ${((s % 9) + 1) * 200} units`, meta: `$${((s % 9) + 1) * 4}.${s % 9}k` }),
  (s) => ({ agentKey: "warehouse", text: `Transfer ${((s % 5) + 1) * 150} to West DC`, meta: "balanced" }),
  (s) => ({ agentKey: "markdown", text: `Markdown ${10 + (s % 4) * 5}% on SKU-${s}`, meta: "queued" }),
  (s) => ({ agentKey: "anomaly", text: `Demand spike, SKU-${s}`, meta: "flagged" }),
];

const INITIAL: Row[] = [
  { id: 1, agentKey: "forecasting", text: "Forecast SKU-1042, 7-day", meta: "94% conf" },
  { id: 2, agentKey: "reorder", text: "Drafted PO, 1,200 units", meta: "$48.2k" },
  { id: 3, agentKey: "anomaly", text: "Demand spike, SKU-2207", meta: "flagged" },
  { id: 4, agentKey: "warehouse", text: "Transfer 450 to West DC", meta: "balanced" },
];

export function LiveConsole() {
  const reduce = useReducedMotion();
  const [rows, setRows] = React.useState<Row[]>(INITIAL);
  const idRef = React.useRef(100);

  React.useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => {
      const sku = 1000 + Math.floor(Math.random() * 9000);
      const make = POOL[Math.floor(Math.random() * POOL.length)];
      setRows((prev) => [{ id: ++idRef.current, ...make(sku) }, ...prev].slice(0, 5));
    }, 2200);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/5">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">acme · operations</span>
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-ok">
          <span className="relative flex size-2">
            {!reduce && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
            )}
            <span className="relative inline-flex size-2 rounded-full bg-ok" />
          </span>
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/70 border-b border-border/70">
        {[
          { l: "Forecast acc.", to: 94, s: "%" },
          { l: "Stockouts", to: 65, p: "-", s: "%" },
          { l: "Capital freed", to: 1.2, p: "$", s: "M", d: 1 },
        ].map((k) => (
          <div key={k.l} className="px-4 py-3.5">
            <div className="font-mono text-xl font-semibold tracking-tight text-foreground tabular">
              <CountUp to={k.to} prefix={k.p} suffix={k.s} decimals={k.d ?? 0} duration={1.6} />
            </div>
            <div className="mt-0.5 text-[0.7rem] text-muted-foreground">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Fixed-height, clipped window: rows slide within it so the page below
          never reflows when a new notification arrives (no layout jerk). */}
      <div className="relative h-[224px] overflow-hidden">
        {rows.map((row) => {
          const agent = AGENTS[row.agentKey];
          const Icon = agent.icon;
          return (
            <motion.div
              key={row.id}
              layout
              initial={reduce ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-14 items-center gap-3 border-b border-border/50 px-4"
            >
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", agent.bg)}>
                <Icon className={cn("size-4", agent.text)} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.8rem] text-foreground">
                <span className={cn("font-medium", agent.text)}>{agent.name}</span> {row.text}
              </span>
              <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground tabular">
                {row.meta}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[0.8rem] font-medium text-foreground">
            PO $48,200 needs approval
          </div>
          <div className="text-[0.7rem] text-muted-foreground">
            over the $10k auto-approve limit
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
            <X className="size-3.5" />
          </span>
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
