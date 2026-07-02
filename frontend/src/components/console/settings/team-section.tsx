"use client";

import * as React from "react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getTenant } from "@/lib/api/client";
import { ErrorState } from "../page-shell";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsCard, SectionHeader } from "./ui";

export function TeamSection() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const query = useQuery(() => getTenant(session), [tenantId, role, clerkActive]);

  return (
    <div>
      <SectionHeader title="Team & roles" description="Who holds each role, and what you can approve." />

      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : query.loading && !query.data ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : query.data ? (
        <SettingsCard>
          <CardContent className="space-y-4 py-5">
            {Object.keys(query.data.team).length > 0 ? (
              <ul role="list" className="divide-y divide-border/60">
                {Object.entries(query.data.team).map(([r, m]) => (
                  <li key={r} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-medium text-foreground">{m.person}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Just you for now — invite teammates from your organization menu (top of the sidebar) to fill these roles.
              </p>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm">
                You are the <span className="font-medium text-foreground">{query.data.you.label}</span>.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {query.data.you.can_approve.length > 0 ? (
                  query.data.you.can_approve.map((s) => (
                    <Badge key={s} variant="outline" className="capitalize">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No approval authority for your role.</span>
                )}
              </div>
            </div>
          </CardContent>
        </SettingsCard>
      ) : null}
    </div>
  );
}
