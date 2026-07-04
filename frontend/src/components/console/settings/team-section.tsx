"use client";

import * as React from "react";
import { X } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getTenant, getInvites, revokeInvite } from "@/lib/api/client";
import { ROLE_META } from "@/lib/roles";
import { ErrorState } from "../page-shell";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsCard, SectionHeader } from "./ui";
import { InviteTeammate } from "../team/invite-teammate";

export function TeamSection() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const query = useQuery(() => getTenant(session), [tenantId, role, clerkActive]);
  const invites = useQuery(() => getInvites(session, "pending"), [tenantId, role, clerkActive]);
  const [revoking, setRevoking] = React.useState<string | null>(null);

  async function revoke(id: string) {
    setRevoking(id);
    try {
      await revokeInvite(session, id);
      invites.refetch();
    } finally {
      setRevoking(null);
    }
  }

  const pending = invites.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader title="Team & roles" description="Who holds each role, and what you can approve." />
          <InviteTeammate thresholds={query.data?.thresholds} onInvited={invites.refetch} />
        </div>

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
                  Just you for now — use{" "}
                  <span className="font-medium text-foreground">Invite teammate</span> to fill these roles.
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

      {pending.length > 0 && (
        <div>
          <SectionHeader
            title="Pending invites"
            description="Teammates who've been invited but haven't joined yet."
          />
          <SettingsCard>
            <CardContent className="py-2">
              <ul role="list" className="divide-y divide-border/60">
                {pending.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{inv.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {inv.roles.map((r) => (
                          <span
                            key={r}
                            className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                          >
                            {ROLE_META[r]?.label ?? r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-critical"
                      onClick={() => revoke(inv.id)}
                      disabled={revoking === inv.id}
                    >
                      <X className="size-4" /> Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </SettingsCard>
        </div>
      )}
    </div>
  );
}
