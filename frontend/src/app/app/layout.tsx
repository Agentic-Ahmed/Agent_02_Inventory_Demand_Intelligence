"use client";

import { SessionProvider } from "@/lib/api/session";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { ConsoleShell } from "@/components/console/console-shell";
import { clerkEnabled } from "@/lib/auth/clerk";
import { ClerkSessionBridge } from "@/components/auth/clerk-session-bridge";
import { RequireAuth } from "@/components/auth/require-auth";
import { WorkspaceGate } from "@/components/auth/workspace-gate";

/**
 * Console root layout. Provides the dev session (tenant + role); when Clerk is on,
 * the bridge overrides it with the verified org/role/user. Gates first-run
 * visitors into the onboarding walkthrough, then wraps every /app/* screen in the
 * sidebar shell. With Clerk configured, RequireAuth sends signed-out visitors to
 * sign-in before any of this renders.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const consoleTree = (
    <SessionProvider>
      {clerkEnabled ? <ClerkSessionBridge /> : null}
      <OnboardingGate>
        <ConsoleShell>{children}</ConsoleShell>
      </OnboardingGate>
    </SessionProvider>
  );

  return clerkEnabled ? (
    <RequireAuth>
      <WorkspaceGate>{consoleTree}</WorkspaceGate>
    </RequireAuth>
  ) : (
    consoleTree
  );
}
