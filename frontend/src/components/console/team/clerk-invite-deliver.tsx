"use client";

import * as React from "react";
import { useOrganization } from "@clerk/nextjs";

/**
 * Render-prop exposing a Clerk org-invite function. Mounted ONLY when Clerk is on
 * (so `useOrganization` has a provider). A Clerk membership carries a single org
 * role, so we map a manager-tier invite to org:admin and everything else to
 * org:member; the full app-role set is persisted separately by the walkthrough.
 */
export function ClerkInviteDeliver({
  children,
}: {
  children: (deliver: (email: string, roles: string[]) => Promise<void>) => React.ReactNode;
}) {
  const { organization } = useOrganization();
  const deliver = React.useCallback(
    async (email: string, roles: string[]) => {
      if (!organization) throw new Error("No active workspace to invite into.");
      const role = roles.includes("manager") ? "org:admin" : "org:member";
      await organization.inviteMember({ emailAddress: email, role });
    },
    [organization],
  );
  return <>{children(deliver)}</>;
}
