"use client";

import { SessionProvider } from "@/lib/api/session";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { ConsoleShell } from "@/components/console/console-shell";

/**
 * Console root layout. Provides the dev session (tenant + role), gates first-run
 * visitors into the onboarding walkthrough, and wraps every /app/* screen in the
 * sidebar shell once onboarded.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OnboardingGate>
        <ConsoleShell>{children}</ConsoleShell>
      </OnboardingGate>
    </SessionProvider>
  );
}
