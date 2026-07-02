"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import type { SkuForecast, ForecastHorizon } from "@/lib/api/types";

/**
 * Demand forecast chart: recent actuals + forecast mean with a confidence band,
 * split by a "today" divider. SVG paths stretch to fill (non-scaling stroke keeps
 * them crisp); axis labels + tooltip are HTML overlays so text isn't distorted.
 */
export function ForecastChart({
  forecast,
  horizon,
}: {
  forecast: SkuForecast;
  horizon: ForecastHorizon;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [activeDay, setActiveDay] = React.useState<number | null>(null);

  const history = forecast.history;
  const points = horizon.points;
  const xMin = -(history.length - 1); // oldest actual
  const xMax = horizon.days;
  const range = xMax - xMin || 1;

  const yMax = Math.max(
    1,
    ...history,
    ...points.map((p) => p.upper),
  ) * 1.1;

  const padY = 6;
  const x = (day: number) => ((day - xMin) / range) * 100;
  const y = (v: number) => padY + (1 - v / yMax) * (100 - padY * 2);

  // Actual line: day -(n-1)..0
  const histPath = history
    .map((v, i) => `${i ? "L" : "M"}${x(xMin + i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");

  // Forecast mean line starts at the last actual so it connects.
  const lastActual = history[history.length - 1] ?? 0;
  const meanPath =
    `M${x(0).toFixed(2)} ${y(lastActual).toFixed(2)} ` +
    points.map((p) => `L${x(p.day).toFixed(2)} ${y(p.mean).toFixed(2)}`).join(" ");

  // Confidence band (upper across, lower back).
  const bandPath =
    `M${x(0).toFixed(2)} ${y(lastActual).toFixed(2)} ` +
    points.map((p) => `L${x(p.day).toFixed(2)} ${y(p.upper).toFixed(2)}`).join(" ") +
    " " +
    [...points].reverse().map((p) => `L${x(p.day).toFixed(2)} ${y(p.lower).toFixed(2)}`).join(" ") +
    ` L${x(0).toFixed(2)} ${y(lastActual).toFixed(2)} Z`;

  const gridValues = [0, yMax / 2, yMax];

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const day = Math.max(xMin, Math.min(xMax, Math.round(xMin + frac * range)));
    setActiveDay(day);
  }

  const active = React.useMemo(() => {
    if (activeDay === null) return null;
    if (activeDay <= 0) {
      const v = history[activeDay - xMin];
      return v === undefined ? null : { day: activeDay, value: v, forecast: false as const };
    }
    const p = points[activeDay - 1];
    return p ? { day: activeDay, value: p.mean, lower: p.lower, upper: p.upper, forecast: true as const } : null;
  }, [activeDay, history, points, xMin]);

  const tipAlign = active
    ? x(active.day) < 22
      ? "translate-x-0"
      : x(active.day) > 78
        ? "-translate-x-full"
        : "-translate-x-1/2"
    : "";

  return (
    <div className="relative">
      {/* y-axis labels */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-64 flex-col justify-between py-[6%] text-[0.7rem] tabular-nums text-muted-foreground">
        <span>{num(Math.round(yMax))}</span>
        <span>{num(Math.round(yMax / 2))}</span>
        <span>0</span>
      </div>

      <div
        ref={ref}
        className="relative h-64 w-full cursor-crosshair touch-none pl-8"
        onPointerMove={handleMove}
        onPointerLeave={() => setActiveDay(null)}
        role="img"
        aria-label={`${forecast.name} demand forecast over ${horizon.days} days`}
      >
        <div className="relative h-full w-full">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="h-full w-full overflow-visible">
            {gridValues.map((gv, i) => (
              <line
                key={i}
                x1="0"
                x2="100"
                y1={y(gv)}
                y2={y(gv)}
                className="stroke-border"
                strokeWidth="1"
                strokeOpacity={i === 0 ? 0.9 : 0.4}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* confidence band */}
            <path d={bandPath} className="fill-primary/15" />

            {/* actual history */}
            <path
              d={histPath}
              fill="none"
              className="stroke-muted-foreground"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* forecast mean */}
            <path
              d={meanPath}
              fill="none"
              className="stroke-primary"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* "today" divider */}
            <line
              x1={x(0)}
              x2={x(0)}
              y1="0"
              y2="100"
              className="stroke-foreground"
              strokeWidth="1"
              strokeOpacity="0.35"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />

            {active ? (
              <line
                x1={x(active.day)}
                x2={x(active.day)}
                y1="0"
                y2="100"
                className="stroke-primary"
                strokeWidth="1"
                strokeOpacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>

          {/* hover dot */}
          {active ? (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                active.forecast ? "bg-primary" : "bg-muted-foreground",
              )}
              style={{ left: `${x(active.day)}%`, top: `${y(active.value)}%` }}
            />
          ) : null}

          {/* tooltip */}
          {active ? (
            <div
              className={cn(
                "pointer-events-none absolute z-20 -mt-2 -translate-y-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md",
                tipAlign,
              )}
              style={{ left: `${x(active.day)}%`, top: `${y(active.value)}%` }}
            >
              <div className="font-medium tabular-nums text-popover-foreground">
                {num(Math.round(active.value))} units
              </div>
              <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                {active.forecast
                  ? `Day +${active.day} · band ${num(Math.round(active.lower))}–${num(Math.round(active.upper))}`
                  : active.day === 0
                    ? "Today (actual)"
                    : `${-active.day}d ago (actual)`}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* x-axis labels */}
      <div className="relative ml-8 mt-2 h-4 text-[0.7rem] text-muted-foreground">
        <span className="absolute left-0">{history.length - 1}d ago</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${x(0)}%` }}>
          Today
        </span>
        <span className="absolute right-0">+{horizon.days}d</span>
      </div>
    </div>
  );
}
