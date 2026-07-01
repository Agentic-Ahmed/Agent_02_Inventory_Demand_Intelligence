"use client";

import * as React from "react";

/**
 * First-run state for the console, scoped to an identity so it follows the
 * person, not just the browser: the key is `quorum.onboarded:<userKey>`, where
 * userKey is the signed-in user id (Clerk) or "anon" in dev. Switching accounts
 * on a shared browser re-onboards correctly; a returning user skips the tour.
 * Real session/auth is Clerk (see lib/auth/clerk.ts); this flag is the
 * lightweight "has this identity seen the tour" marker layered on top of it.
 */
const KEY_PREFIX = "quorum.onboarded";
const LEGACY_KEY = "quorum.onboarded"; // pre-scoping flag, migrated into "anon"

export type OnboardingStatus = "loading" | "first-run" | "done";

function storageKey(userKey: string): string {
  return `${KEY_PREFIX}:${userKey}`;
}

export function useOnboarding(userKey = "anon") {
  const key = storageKey(userKey);
  // "loading" until the effect reads storage — avoids a flash of the tour for an
  // already-onboarded identity.
  const [status, setStatus] = React.useState<OnboardingStatus>("loading");

  React.useEffect(() => {
    try {
      let done = localStorage.getItem(key) === "1";
      // One-time migration of the old unscoped flag into the dev ("anon") scope.
      if (!done && userKey === "anon" && localStorage.getItem(LEGACY_KEY) === "1") {
        localStorage.setItem(key, "1");
        done = true;
      }
      setStatus(done ? "done" : "first-run");
    } catch {
      setStatus("first-run");
    }
  }, [key, userKey]);

  const complete = React.useCallback(() => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode / disabled storage: degrade to in-memory for this session */
    }
    setStatus("done");
  }, [key]);

  const reset = React.useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setStatus("first-run");
  }, [key]);

  return { status, complete, reset };
}
