"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Interactive trend line for KPI tiles. Hover (or drag on touch) snaps to the
 * nearest point and shows its formatted value with a guide line + highlight dot.
 * Color follows `currentColor`, so the parent sets tone via a text-* class.
 */
export function Sparkline({
  data,
  format = (n) => String(n),
  label,
  className,
}: {
  data: number[];
  format?: (n: number) => string;
  /** Metric name, used only to build the screen-reader description. */
  label?: string;
  className?: string;
}) {
  const gid = React.useId();
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<number | null>(null);

  if (!data || data.length < 2) return null;

  const w = 100;
  const h = 32;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);

  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return { x, y, v };
  });

  const line = pts.map(({ x, y }, i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const first = pts[0];
  const lastPt = pts[pts.length - 1];
  const area = `${line} L${lastPt.x.toFixed(2)} ${h} L${first.x.toFixed(2)} ${h} Z`;

  const act = active != null ? pts[active] : null;

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(frac * (data.length - 1))));
    setActive(i);
  }

  // Keep the tooltip inside the card: hug the edge when near either end.
  const tipAlign = act ? (act.x < 20 ? "translate-x-0" : act.x > 80 ? "-translate-x-full" : "-translate-x-1/2") : "";

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${label ? `${label} trend` : "Trend"}: ${format(first.v)} to ${format(lastPt.v)}`}
      className={cn("relative touch-none", className)}
      onPointerMove={handleMove}
      onPointerLeave={() => setActive(null)}
    >
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className="h-9 w-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {act ? (
          <line
            x1={act.x}
            y1={0}
            x2={act.x}
            y2={h}
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {/* Zero-length round-capped path = a crisp dot unaffected by the non-uniform stretch. */}
        <path
          d={`M${lastPt.x.toFixed(2)} ${lastPt.y.toFixed(2)} l0.01 0`}
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {act ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-card"
            style={{ left: `${act.x}%`, top: `${(act.y / h) * 100}%` }}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-20 -mt-2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium tabular-nums text-popover-foreground shadow-md",
              tipAlign,
            )}
            style={{ left: `${act.x}%`, top: `${(act.y / h) * 100}%` }}
          >
            {format(act.v)}
          </div>
        </>
      ) : null}
    </div>
  );
}
