"use client";

import type { ReactNode } from "react";
import { useAuth, RedirectToSignIn } from "@clerk/nextjs";

/**
 * Client-side console guard. Renders children only for signed-in users; signed-out
 * visitors are redirected to /sign-in (configured on ClerkProvider) and returned to
 * /app after signing in. Reliable complement to the proxy.ts middleware.
 *
 * Only mount this when Clerk is configured — it needs ClerkProvider context, which
 * the root layout adds only with keys set. (This @clerk/nextjs build exposes
 * useAuth + RedirectToSignIn but not the <SignedIn>/<SignedOut> control components.)
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return null; // brief: wait for Clerk to resolve the session
  if (!userId) return <RedirectToSignIn />;
  return <>{children}</>;
}
