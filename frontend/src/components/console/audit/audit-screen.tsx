"use client";

import * as React from "react";
import { Search, ScrollText } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getAudit } from "@/lib/api/client";
import { PageContainer, PageHeader, ErrorState } from "../page-shell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AuditEventRow } from "./audit-event-row";
import { eventMeta, groupByDay } from "./audit-meta";

export function AuditScreen() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(
    () => ({ tenantId, role, getToken }),
    [tenantId, role, getToken],
  );

  const query = useQuery(() => getAudit(session, 100), [tenantId, role, clerkActive]);

  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  // Newest first, regardless of source order.
  const events = React.useMemo(() => {
    const list = query.data ?? [];
    return [...list].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [query.data]);

  const types = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1);
    return [
      { key: "all", label: "All", count: events.length },
      ...[...counts.entries()].map(([t, c]) => ({ key: t, label: eventMeta(t).label, count: c })),
    ];
  }, [events]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
      if (!q) return true;
      const hay = `${e.summary} ${e.actor} ${e.event_type} ${JSON.stringify(e.detail)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, typeFilter, search]);

  const groups = React.useMemo(() => groupByDay(filtered), [filtered]);
  const loading = query.loading && !query.data;
  const filtersActive = typeFilter !== "all" || search.trim().length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Every autonomous decision and human approval, in order and reasoned."
      />

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter by event type" className="flex flex-wrap gap-1.5">
          {types.map(({ key, label, count }) => {
            const active = typeFilter === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setTypeFilter(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the log…"
            aria-label="Search the audit log"
            className="pl-9"
          />
        </div>
      </div>

      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : loading ? (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3.5">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pb-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filtersActive={filtersActive} />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="sticky top-0 z-10 mb-3 bg-background/85 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                {group.label}
              </h2>
              <ol role="list">
                {group.events.map((event, i) => (
                  <AuditEventRow
                    key={event.id}
                    event={event}
                    last={i === group.events.length - 1}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function EmptyState({ filtersActive }: { filtersActive: boolean }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-16 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ScrollText className="size-5.5" />
      </span>
      <p className="text-sm font-medium text-foreground">
        {filtersActive ? "No matching events" : "No activity yet"}
      </p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {filtersActive
          ? "Try a different event type or search term."
          : "Agent runs, tool calls, and approvals will appear here as they happen."}
      </p>
    </div>
  );
}
