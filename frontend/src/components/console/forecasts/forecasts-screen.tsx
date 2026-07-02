"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getForecasts } from "@/lib/api/client";
import { PageContainer, PageHeader, ErrorState } from "../page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { num, pct } from "@/lib/format";
import type { Horizon, SkuForecast } from "@/lib/api/types";
import { SkuList } from "./sku-list";
import { ForecastChart } from "./forecast-chart";

const HORIZONS: Horizon[] = [7, 30, 90];

const STATUS_BADGE: Record<SkuForecast["status"], { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "border-ok/30 bg-ok/10 text-ok" },
  low: { label: "Low", className: "border-warn/30 bg-warn/10 text-warn" },
  critical: { label: "Critical", className: "border-critical/30 bg-critical/10 text-critical" },
  overstock: { label: "Overstock", className: "border-horizon/30 bg-horizon/10 text-horizon" },
};

export function ForecastsScreen() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);

  const query = useQuery(() => getForecasts(session), [tenantId, role, clerkActive]);
  const items = React.useMemo(() => query.data ?? [], [query.data]);

  const [selectedSku, setSelectedSku] = React.useState<string | null>(null);
  const [horizon, setHorizon] = React.useState<Horizon>(30);

  // Keep a valid selection as data changes (tenant switch, sample toggle).
  React.useEffect(() => {
    if (items.length === 0) {
      setSelectedSku(null);
    } else if (!items.some((f) => f.sku === selectedSku)) {
      setSelectedSku(items[0].sku);
    }
  }, [items, selectedSku]);

  const selected = items.find((f) => f.sku === selectedSku) ?? items[0];
  const loading = query.loading && !query.data;

  return (
    <PageContainer>
      <PageHeader
        title="Forecasts"
        description="Per-SKU demand over 7, 30, and 90 days, with a confidence band and stockout risk."
      />

      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : loading ? (
        <ForecastsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
          <Card className="glass bg-white/60 p-3 dark:bg-white/10">
            <SkuList items={items} selected={selected?.sku ?? ""} onSelect={setSelectedSku} />
          </Card>

          {selected ? <ForecastDetail forecast={selected} horizon={horizon} onHorizon={setHorizon} /> : null}
        </div>
      )}
    </PageContainer>
  );
}

function ForecastDetail({
  forecast,
  horizon,
  onHorizon,
}: {
  forecast: SkuForecast;
  horizon: Horizon;
  onHorizon: (h: Horizon) => void;
}) {
  const h = forecast.horizons[horizon];
  const badge = STATUS_BADGE[forecast.status];
  const stockout = h.projected_stockout_day;

  return (
    <div className="min-w-0 space-y-6">
      {/* SKU header + horizon toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-foreground">{forecast.name}</h2>
            <Badge variant="outline" className={cn("shrink-0", badge.className)}>
              {badge.label}
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {forecast.sku} · {num(forecast.on_hand)} on hand
          </p>
        </div>

        <div role="tablist" aria-label="Forecast horizon" className="flex shrink-0 gap-1 rounded-lg border border-border p-0.5">
          {HORIZONS.map((d) => {
            const active = d === horizon;
            return (
              <button
                key={d}
                role="tab"
                aria-selected={active}
                onClick={() => onHorizon(d)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium tabular-nums transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}d
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <Card className="glass bg-white/60 gap-0 p-4 dark:bg-white/10">
        <ForecastChart forecast={forecast} horizon={h} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <LegendSwatch className="bg-muted-foreground" label="Actual" />
          <LegendSwatch className="bg-primary" label="Forecast" dashed />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-primary/20" />
            Confidence band
          </span>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Predicted demand`} value={`${num(h.predicted_total)}`} foot={`units · next ${horizon}d`} />
        <Stat label="Daily average" value={`${num(Math.round(h.daily_mean))}`} foot="units / day" />
        <Stat label="Confidence" value={pct(h.confidence, 0)} foot={h.confidence < 0.7 ? "below review threshold" : "model confidence"} tone={h.confidence < 0.7 ? "warn" : undefined} />
        <Stat
          label="Projected stockout"
          value={stockout ? `${stockout}d` : "None"}
          foot={stockout ? `at current demand` : `beyond ${horizon}d`}
          tone={stockout ? (stockout <= 7 ? "critical" : "warn") : "ok"}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  foot,
  tone,
}: {
  label: string;
  value: string;
  foot?: string;
  tone?: "warn" | "critical" | "ok";
}) {
  const toneClass =
    tone === "critical" ? "text-critical" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-foreground";
  return (
    <Card className="glass bg-white/60 gap-0 p-4 dark:bg-white/10">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("mt-1 block text-2xl font-semibold tabular-nums tracking-tight", toneClass)}>
        {value}
      </span>
      {foot ? <span className="mt-0.5 block text-xs text-muted-foreground">{foot}</span> : null}
    </Card>
  );
}

function LegendSwatch({ className, label, dashed }: { className: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-0.5 w-4 rounded-full", className, dashed && "opacity-90")} />
      {label}
    </span>
  );
}

function ForecastsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
      <Skeleton className="h-80 w-full rounded-xl" />
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TrendingUp className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">No SKUs to forecast yet</p>
      <p className="flex max-w-xs items-center gap-1 text-sm text-muted-foreground">
        Forecasts appear once your workspace has inventory. Load sample data from the Dashboard to explore.
      </p>
    </div>
  );
}
