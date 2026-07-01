import * as React from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import type { InventoryRow } from "@/lib/api/client";

const STATUS: Record<InventoryRow["status"], { label: string; dot: string; text: string }> = {
  healthy: { label: "Healthy", dot: "bg-ok", text: "text-ok" },
  low: { label: "Low", dot: "bg-warn", text: "text-warn" },
  critical: { label: "Critical", dot: "bg-critical", text: "text-critical" },
  overstock: { label: "Overstock", dot: "bg-horizon", text: "text-horizon" },
};

export function InventoryHealth({
  rows,
  loading,
}: {
  rows?: InventoryRow[];
  loading?: boolean;
}) {
  return (
    <Card className="glass bg-card/50 gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle>Inventory health</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* column header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>SKU</span>
          <span className="text-right tabular-nums">Days cover</span>
          <span className="w-24 text-right">Status</span>
        </div>
        {loading ? (
          <div className="space-y-3 p-4 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border/60">
            {rows?.map((row) => {
              const s = STATUS[row.status];
              return (
                <li
                  key={row.sku}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.sku} · {num(row.on_hand)} on hand
                    </p>
                  </div>
                  <span className="text-right text-sm tabular-nums text-foreground">
                    {row.days_cover}d
                  </span>
                  <span className={cn("flex w-24 items-center justify-end gap-1.5 text-sm font-medium", s.text)}>
                    <span className={cn("size-1.5 rounded-full", s.dot)} />
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
