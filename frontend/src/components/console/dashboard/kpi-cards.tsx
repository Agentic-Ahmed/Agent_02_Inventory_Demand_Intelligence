import * as React from "react";
import { Target, PackageX, PiggyBank, Timer, ArrowUp, ArrowDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { pct, compactCurrency } from "@/lib/format";
import type { DashboardKpis } from "@/lib/api/client";

type Tone = "good" | "bad" | "flat";

interface Kpi {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: { text: string; dir: "up" | "down"; tone: Tone };
  foot?: string;
}

function buildKpis(d: DashboardKpis): Kpi[] {
  return [
    {
      icon: Target,
      label: "Forecast accuracy",
      value: pct(d.forecast_accuracy, 1),
      delta: {
        text: `${(d.forecast_accuracy_delta * 100).toFixed(1)} pts`,
        dir: d.forecast_accuracy_delta >= 0 ? "up" : "down",
        tone: d.forecast_accuracy_delta >= 0 ? "good" : "bad",
      },
      foot: "vs. last 30 days",
    },
    {
      icon: PackageX,
      label: "Stockout rate",
      value: pct(d.stockout_rate, 1),
      delta: {
        // Lower is better, so a negative change is good.
        text: `${Math.abs(d.stockout_rate_delta * 100).toFixed(1)} pts`,
        dir: d.stockout_rate_delta <= 0 ? "down" : "up",
        tone: d.stockout_rate_delta <= 0 ? "good" : "bad",
      },
      foot: "vs. last 30 days",
    },
    {
      icon: PiggyBank,
      label: "Capital freed",
      value: compactCurrency(d.capital_freed),
      delta: {
        text: compactCurrency(Math.abs(d.capital_freed_delta)),
        dir: d.capital_freed_delta >= 0 ? "up" : "down",
        tone: d.capital_freed_delta >= 0 ? "good" : "bad",
      },
      foot: "carrying cost reduced",
    },
    {
      icon: Timer,
      label: "Reorder cycle",
      value: `${d.reorder_cycle_hours.toFixed(1)}h`,
      foot: d.reorder_cycle_hours < 4 ? "under 4h target" : "above 4h target",
    },
  ];
}

const toneClass: Record<Tone, string> = {
  good: "text-ok",
  bad: "text-critical",
  flat: "text-muted-foreground",
};

export function KpiCards({ data, loading }: { data?: DashboardKpis; loading?: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-28" />
          </Card>
        ))}
      </div>
    );
  }

  const kpis = buildKpis(data);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map(({ icon: Icon, label, value, delta, foot }) => (
        <Card key={label} className="gap-0 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </span>
            {delta ? (
              <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", toneClass[delta.tone])}>
                {delta.dir === "up" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {delta.text}
              </span>
            ) : null}
          </div>
          {foot ? <p className="mt-1 text-xs text-muted-foreground">{foot}</p> : null}
        </Card>
      ))}
    </div>
  );
}
