"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clerkEnabled } from "@/lib/auth/clerk";
import { useSession } from "@/lib/api/session";
import type { TenantThresholds } from "@/lib/api/types";
import { InviteWalkthrough } from "./invite-walkthrough";
import { ClerkInviteDeliver } from "./clerk-invite-deliver";

/**
 * "Invite teammate" button + its walkthrough modal. When Clerk is on, delivery goes
 * through a real organization invitation (email); in dev the invite is recorded and
 * shown as pending. The Clerk hook lives behind clerkEnabled so it never runs without
 * a provider.
 */
export function InviteTeammate({
  thresholds,
  onInvited,
}: {
  thresholds?: TenantThresholds;
  onInvited?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { tenantId, role, getToken } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Invite teammate
      </Button>
      {open &&
        (clerkEnabled ? (
          <ClerkInviteDeliver>
            {(deliver) => (
              <InviteWalkthrough
                session={session}
                thresholds={thresholds}
                deliver={deliver}
                onClose={() => setOpen(false)}
                onInvited={onInvited}
              />
            )}
          </ClerkInviteDeliver>
        ) : (
          <InviteWalkthrough
            session={session}
            thresholds={thresholds}
            onClose={() => setOpen(false)}
            onInvited={onInvited}
          />
        ))}
    </>
  );
}
