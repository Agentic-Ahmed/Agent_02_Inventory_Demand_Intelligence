"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getUsage } from "@/lib/api/client";
import { ErrorState } from "../page-shell";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { num, compactNum } from "@/lib/format";
import { AGENTS, type AgentKey } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { SettingsCard, SectionHeader } from "./ui";

const PLAN = {
  name: "Growth",
  price: "$499",
  period: "/mo",
  tokenQuota: 5_000_000,
  features: [
    "All six agents, unlimited SKUs",
    "Usage-based token metering",
    "Human approval guardrails",
    "Email + Slack alerts",
  ],
};

export function BillingSection() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const query = useQuery(() => getUsage(session), [tenantId, role, clerkActive]);

  const usage = query.data;
  const pctUsed = usage ? Math.min(100, (usage.total_tokens / PLAN.tokenQuota) * 100) : 0;

  // Per-agent token breakdown (backend metering), largest first.
  const agentRows = Object.entries(usage?.tokens_by_agent ?? {})
    .map(([key, tokens]) => ({ key, tokens: tokens ?? 0 }))
    .filter((r) => r.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
  const agentTotal = agentRows.reduce((s, r) => s + r.tokens, 0) || 1;

  return (
    <div>
      <SectionHeader title="Billing & usage" description="Your plan and what your agents have consumed this period." />

      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : query.loading && !query.data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : usage ? (
        <div className="space-y-4">
          {/* Plan */}
          <SettingsCard>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                Current plan
                <Badge className="bg-primary/15 text-primary">{PLAN.name}</Badge>
              </CardTitle>
              <CardDescription>
                {PLAN.price}
                <span className="text-muted-foreground">{PLAN.period}</span> · billed monthly, plus token usage
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {PLAN.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 shrink-0 text-ok" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="shrink-0" disabled>
                Manage billing
              </Button>
            </CardContent>
          </SettingsCard>

          {/* Usage this period */}
          <SettingsCard>
            <CardHeader className="border-b pb-4">
              <CardTitle>Usage this period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 py-5">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-foreground">Tokens</span>
                  <span className="tabular-nums text-muted-foreground">
                    {compactNum(usage.total_tokens)} / {compactNum(PLAN.tokenQuota)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pctUsed}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pctUsed.toFixed(0)}% of the included monthly allotment.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <UsageStat label="Agent runs" value={num(usage.agent_runs)} />
                <UsageStat label="Tool calls" value={num(usage.tool_calls)} />
                <UsageStat label="Escalations" value={num(usage.escalations)} />
                <UsageStat label="Approvals resolved" value={num(usage.approvals_resolved)} />
              </div>

              {agentRows.length > 0 ? (
                <div className="border-t pt-5">
                  <p className="mb-3 text-sm font-medium text-foreground">Tokens by agent</p>
                  <ul className="space-y-3">
                    {agentRows.map(({ key, tokens }) => {
                      const meta = AGENTS[key as AgentKey];
                      const Icon = meta?.icon;
                      const pct = Math.round((tokens / agentTotal) * 100);
                      return (
                        <li key={key}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              {Icon ? <Icon className={cn("size-4", meta.text)} /> : null}
                              <span className="text-foreground">{meta?.name ?? key}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {compactNum(tokens)} · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </SettingsCard>
        </div>
      ) : null}
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
