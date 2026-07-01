"use client";

import * as React from "react";

import { Brand } from "@/components/brand";
import { useSession } from "@/lib/api/session";
import { useOnboarding } from "./use-onboarding";
import { Walkthrough } from "./walkthrough";

/**
 * First-run guard for the whole console. Wraps every /app/* screen:
 *   loading   -> a quiet brand splash (no flash of the tour for returning users)
 *   first-run -> the Walkthrough (anyone who taps "Sign in"/"Start free" and has
 *                never onboarded); completing it lands straight in the console
 *   done      -> the console (children)
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { userKey } = useSession();
  const { status, complete } = useOnboarding(userKey);

  if (status === "loading") return <EntrySplash />;
  if (status === "first-run") return <Walkthrough onComplete={complete} />;
  return <>{children}</>;
}

function EntrySplash() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-background"
      role="status"
      aria-label="Loading your workspace"
    >
      <div className="flex flex-col items-center gap-4">
        <Brand showWordmark={false} markClassName="size-8 animate-pulse" />
        <span className="h-1 w-24 overflow-hidden rounded-full bg-border">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </span>
      </div>
    </div>
  );
}
