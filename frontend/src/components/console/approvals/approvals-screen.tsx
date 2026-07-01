"use client";

import * as React from "react";
import { CheckCircle2, Inbox } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getApprovals, resolveApproval, ROLE_LABEL } from "@/lib/api/client";
import type { Approval, ApprovalStatus } from "@/lib/api/types";
import { PageContainer, PageHeader, ErrorState } from "../page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ApprovalCard } from "./approval-card";

type Filter = ApprovalStatus | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

/** Newest first, with anything still pending floated to the top. */
function byUrgency(a: Approval, b: Approval): number {
  const ap = a.status === "pending" ? 0 : 1;
  const bp = b.status === "pending" ? 0 : 1;
  if (ap !== bp) return ap - bp;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function ApprovalsScreen() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(
    () => ({ tenantId, role, getToken }),
    [tenantId, role, getToken],
  );

  const query = useQuery(() => getApprovals(session, "all"), [tenantId, role, clerkActive]);

  // Local copy so a resolve updates in place without a full refetch.
  const [list, setList] = React.useState<Approval[]>([]);
  React.useEffect(() => {
    if (query.data) setList(query.data);
  }, [query.data]);

  const [filter, setFilter] = React.useState<Filter>("pending");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const actor = ROLE_LABEL[role] ?? role;

  async function resolve(id: string, action: "approve" | "reject", note?: string) {
    setBusyId(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const updated = await resolveApproval(session, id, { action, by: actor, note });
      setList((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [id]: err instanceof Error ? err.message : "Couldn't save. Try again.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  const counts = React.useMemo(
    () => ({
      pending: list.filter((a) => a.status === "pending").length,
      approved: list.filter((a) => a.status === "approved").length,
      rejected: list.filter((a) => a.status === "rejected").length,
      all: list.length,
    }),
    [list],
  );

  const visible = React.useMemo(() => {
    const base = filter === "all" ? list : list.filter((a) => a.status === filter);
    return [...base].sort(byUrgency);
  }, [list, filter]);

  const loading = query.loading && list.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Approval inbox"
        description="Money and price actions that tripped a guardrail. Approve, reject, and it's all audited."
      >
        <Badge variant="outline" className="font-normal">
          Acting as <span className="ml-1 font-medium text-foreground">{actor}</span>
        </Badge>
      </PageHeader>

      {/* Status filter */}
      <div
        role="tablist"
        aria-label="Filter approvals by status"
        className="mb-5 inline-flex items-center gap-1 rounded-lg bg-muted p-1"
      >
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-muted text-foreground" : "bg-background/60 text-muted-foreground",
                )}
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul role="list" className="space-y-4">
          {visible.map((item) => (
            <li key={item.id}>
              <ApprovalCard
                item={item}
                role={role}
                busy={busyId === item.id}
                error={errors[item.id] || undefined}
                onResolve={(action, note) => resolve(item.id, action, note)}
              />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const pendingZero = filter === "pending";
  const Icon = pendingZero ? CheckCircle2 : Inbox;
  const title = pendingZero ? "Inbox zero" : filter === "all" ? "No approvals yet" : `No ${filter} items`;
  const body = pendingZero
    ? "Nothing is waiting on a human right now. Agents are running inside their limits."
    : "Nothing here yet — resolved items will show up in this view.";
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-16 text-center"
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full",
          pendingZero ? "bg-ok/10 text-ok" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5.5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
