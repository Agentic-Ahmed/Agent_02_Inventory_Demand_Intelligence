"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import type { SkuForecast } from "@/lib/api/types";

const STATUS_DOT: Record<SkuForecast["status"], string> = {
  healthy: "bg-ok",
  low: "bg-warn",
  critical: "bg-critical",
  overstock: "bg-horizon",
};

/** Searchable SKU picker. Selecting one drives the forecast detail. */
export function SkuList({
  items,
  selected,
  onSelect,
}: {
  items: SkuForecast[];
  selected: string;
  onSelect: (sku: string) => void;
}) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (f) => f.name.toLowerCase().includes(needle) || f.sku.toLowerCase().includes(needle),
    );
  }, [items, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search SKUs…"
          aria-label="Search SKUs"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">No SKUs match.</p>
      ) : (
        <ul role="list" className="flex flex-col gap-1">
          {filtered.map((f) => {
            const isActive = f.sku === selected;
            return (
              <li key={f.sku}>
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => onSelect(f.sku)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/10"
                      : "border-transparent hover:bg-muted/60",
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[f.status])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{f.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{f.sku}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {num(f.on_hand)}
                    <span className="block text-[0.7rem]">on hand</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
