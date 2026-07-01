"use client";

import * as React from "react";
import { Check, X, AlertTriangle, Lock, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relativeTime, dateTime } from "@/lib/format";
import { ROLE_LABEL, canApprove } from "@/lib/api/client";
import type { Approval } from "@/lib/api/types";
import {
  ACTION_META,
  actionAgentColors,
  STATUS_STYLE,
  describeDetail,
  detailReason,
} from "../approval-meta";

export function ApprovalCard({
  item,
  role,
  busy,
  error,
  onResolve,
}: {
  item: Approval;
  role: string;
  busy: boolean;
  error?: string;
  onResolve: (action: "approve" | "reject", note?: string) => void;
}) {
  const [note, setNote] = React.useState("");
  const meta = ACTION_META[item.action_type];
  const Icon = meta.icon;
  const colors = actionAgentColors(item.action_type);
  const status = STATUS_STYLE[item.status];
  const reason = detailReason(item.detail);
  const facts = describeDetail(item.detail);

  const isPending = item.status === "pending";
  const canAct = isPending && canApprove(role, item.required_role);
  const requiredLabel = item.required_role
    ? ROLE_LABEL[item.required_role] ?? item.required_role
    : null;

  return (
    <Card className="gap-0 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            colors.bg,
            colors.text,
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
            <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>
          {reason ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-warn">
              <AlertTriangle className="size-3.5 shrink-0" />
              {reason}
            </p>
          ) : null}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground/70">
            Raised {relativeTime(item.created_at)}
          </p>
        </div>
      </div>

      {facts.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/60 bg-muted/20 px-4 py-3 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="truncate text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                {f.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-foreground">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="border-t border-border/60 p-3 sm:px-4">
        {!isPending ? (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full",
                status.className,
              )}
            >
              {item.status === "approved" ? (
                <Check className="size-3" />
              ) : (
                <X className="size-3" />
              )}
            </span>
            <span className="text-foreground">
              {status.label} by <span className="font-medium">{item.resolved_by ?? "—"}</span>
            </span>
            {item.resolved_at ? (
              <span className="text-muted-foreground">· {dateTime(item.resolved_at)}</span>
            ) : null}
          </div>
        ) : canAct ? (
          <div className="space-y-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note (optional) — recorded in the audit trail."
              aria-label="Approval note"
              disabled={busy}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
            {error ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              {busy ? (
                <Loader2 className="mr-1 size-4 animate-spin text-muted-foreground" aria-hidden />
              ) : null}
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => onResolve("reject", note.trim() || undefined)}
              >
                <X className="size-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onResolve("approve", note.trim() || undefined)}
              >
                <Check className="size-3.5" />
                Approve
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            <span>
              Requires{" "}
              <span className="font-medium text-foreground">{requiredLabel ?? "manager"}</span>{" "}
              approval
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
