"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/api/session";
import type { TenantThresholds } from "@/lib/api/types";
import { InviteWalkthrough } from "./invite-walkthrough";

/**
 * "Invite teammate" button + its walkthrough modal. Delivery (a real Clerk organization
 * invitation email, when Clerk is configured) happens server-side in
 * POST /api/team/invites — see backend/api/routes/team.py — so this component doesn't
 * need to know whether Clerk is on; it just records the invite and shows what happened.
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
      {open && (
        <InviteWalkthrough
          session={session}
          thresholds={thresholds}
          onClose={() => setOpen(false)}
          onInvited={onInvited}
        />
      )}
    </>
  );
}
