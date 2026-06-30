import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/api/client";
import type { Approval } from "@/lib/api/types";
import { ACTION_META, actionAgentColors } from "../approval-meta";

export function PendingApprovalsCard({
  items,
  loading,
}: {
  items?: Approval[];
  loading?: boolean;
}) {
  const top = items?.slice(0, 4) ?? [];

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle>Pending approvals</CardTitle>
        {items && items.length > 0 ? (
          <CardAction>
            <Link
              href="/app/approvals"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Review all
              <ArrowRight className="size-3.5" />
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : top.length === 0 ? (
          <div role="status" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-ok/10 text-ok">
              <Check className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="text-sm text-muted-foreground">Nothing is waiting on a human right now.</p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border/60">
            {top.map((item) => {
              const meta = ACTION_META[item.action_type];
              const Icon = meta.icon;
              const colors = actionAgentColors(item.action_type);
              return (
                <li key={item.id}>
                  <Link
                    href="/app/approvals"
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                        colors.bg,
                        colors.text,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{meta.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {item.summary}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {relativeTime(item.created_at)}
                      </span>
                      {item.required_role ? (
                        <Badge variant="outline" className="text-[0.7rem]">
                          {ROLE_LABEL[item.required_role] ?? item.required_role}
                        </Badge>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
