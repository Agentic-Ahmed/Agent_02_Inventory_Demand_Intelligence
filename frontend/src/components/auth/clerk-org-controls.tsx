"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

/**
 * Sidebar footer controls when Clerk is on: switch organization (= tenant) and
 * open the user/account menu. Replaces the dev TenantSwitcher. Role is no longer
 * a free pick here — it comes from the user's membership role in the active org.
 */
export function ClerkOrgControls() {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-2 py-1.5">
      <OrganizationSwitcher
        hidePersonal
        appearance={{ elements: { rootBox: "min-w-0 flex-1", organizationSwitcherTrigger: "w-full justify-start" } }}
      />
      <UserButton />
    </div>
  );
}
