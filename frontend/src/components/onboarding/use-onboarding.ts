"use client";

import * as React from "react";

/**
 * First-run state for the /app entry. Persists a single flag in localStorage so a
 * returning user who taps "Sign in" / "Start free" skips the walkthrough and lands
 * straight in their workspace. Real session/auth (Clerk) is dormant for now
 * (see CLAUDE.md S2 + backend/core/auth.py), so this is the lightweight stand-in.
 */
const STORAGE_KEY = "quorum.onboarded";

export type OnboardingStatus = "loading" | "first-run" | "done";

export function useOnboarding() {
  // "loading" until the effect reads localStorage — avoids a hydration flash where
  // the walkthrough briefly shows for an already-onboarded user.
  const [status, setStatus] = React.useState<OnboardingStatus>("loading");

  React.useEffect(() => {
    try {
      setStatus(localStorage.getItem(STORAGE_KEY) === "1" ? "done" : "first-run");
    } catch {
      setStatus("first-run");
    }
  }, []);

  const complete = React.useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode / disabled storage: degrade to in-memory for this session */
    }
    setStatus("done");
  }, []);

  const reset = React.useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setStatus("first-run");
  }, []);

  return { status, complete, reset };
}
