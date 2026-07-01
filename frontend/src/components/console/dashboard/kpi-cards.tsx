import * as React from "react";
import { Target, PackageX, PiggyBank, Timer, ArrowUp, ArrowDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { pct, compactCurrency } from "@/lib/format";
import type { DashboardKpis } from "@/lib/api/client";
import { Sparkline } from "./sparkline";

type Tone = "good" | "bad" | "flat";

interface Kpi {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: Tone;
  trend: number[];
  /** Formats a trend point for the hover tooltip. */
  trendFormat: (n: number) => string;
  delta?: { text: string; dir: "up" | "down" };
  pill?: string;
  foot?: string;
}

const REORDER_TARGET_H = 4;

function buildKpis(d: DashboardKpis): Kpi[] {
  const cycleGood = d.reorder_cycle_hours <= REORDER_TARGET_H;
  return [
    {
      icon: Target,
      label: "Forecast accuracy",
      value: pct(d.forecast_accuracy, 1),
      tone: d.forecast_accuracy_delta >= 0 ? "good" : "bad",
      trend: d.forecast_accuracy_trend,
      trendFormat: (n) => pct(n, 1),
      delta: {
        text: `${(d.forecast_accuracy_delta * 100).toFixed(1)} pts`,
        dir: d.forecast_accuracy_delta >= 0 ? "up" : "down",
      },
      foot: "vs. last 30 days",
    },
    {
      icon: PackageX,
      label: "Stockout rate",
      value: pct(d.stockout_rate, 1),
      // Lower is better, so a fall (negative delta) is good.
      tone: d.stockout_rate_delta <= 0 ? "good" : "bad",
      trend: d.stockout_rate_trend,
      trendFormat: (n) => pct(n, 1),
      delta: {
        text: `${Math.abs(d.stockout_rate_delta * 100).toFixed(1)} pts`,
        dir: d.stockout_rate_delta <= 0 ? "down" : "up",
      },
      foot: "vs. last 30 days",
    },
    {
      icon: PiggyBank,
      label: "Capital freed",
      value: compactCurrency(d.capital_freed),
      tone: d.capital_freed_delta >= 0 ? "good" : "bad",
      trend: d.capital_freed_trend,
      trendFormat: (n) => compactCurrency(n),
      delta: {
        text: compactCurrency(Math.abs(d.capital_freed_delta)),
        dir: d.capital_freed_delta >= 0 ? "up" : "down",
      },
      foot: "carrying cost reduced",
    },
    {
      icon: Timer,
      label: "Reorder cycle",
      value: `${d.reorder_cycle_hours.toFixed(1)}h`,
      tone: cycleGood ? "good" : "bad",
      trend: d.reorder_cycle_trend,
      trendFormat: (n) => `${n.toFixed(1)}h`,
      pill: cycleGood ? "On target" : "Over target",
      foot: `target under ${REORDER_TARGET_H}h`,
    },
  ];
}

const toneText: Record<Tone, string> = {
  good: "text-ok",
  bad: "text-critical",
  flat: "text-muted-foreground",
};

const tonePill: Record<Tone, string> = {
  good: "bg-ok/10 text-ok",
  bad: "bg-critical/10 text-critical",
  flat: "bg-muted text-muted-foreground",
};

export function KpiCards({ data, loading }: { data?: DashboardKpis; loading?: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass bg-card/50 gap-0 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-4 h-9 w-full" />
            <Skeleton className="mt-3 h-3 w-28" />
          </Card>
        ))}
      </div>
    );
  }

  const kpis = buildKpis(data);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map(({ icon: Icon, label, value, tone, trend, trendFormat, delta, pill, foot }) => (
        <Card key={label} className="glass bg-card/50 gap-0 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </span>
            {delta ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
                  tonePill[tone],
                )}
              >
                {delta.dir === "up" ? (
                  <ArrowUp className="size-3" />
                ) : (
                  <ArrowDown className="size-3" />
                )}
                {delta.text}
              </span>
            ) : pill ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-medium",
                  tonePill[tone],
                )}
              >
                {pill}
              </span>
            ) : null}
          </div>

          <div className={cn("mt-3", toneText[tone])}>
            <Sparkline data={trend} format={trendFormat} label={label} />
          </div>

          {foot ? <p className="mt-2 text-xs text-muted-foreground">{foot}</p> : null}
        </Card>
      ))}
    </div>
  );
}
