"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";

import { useSession } from "@/lib/api/session";
import { mapClerkRole } from "@/lib/auth/clerk";

/**
 * Feeds the verified Clerk identity into the app session: active org -> tenant,
 * org role -> role, user id -> onboarding scope, and getToken -> the bearer the
 * API client sends. Rendered only when Clerk is enabled (inside ClerkProvider).
 * Renders nothing.
 */
export function ClerkSessionBridge() {
  const { isLoaded, isSignedIn, userId, orgId, orgSlug, orgRole, getToken } = useAuth();
  const { registerAuth } = useSession();

  React.useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      registerAuth(null);
      return;
    }
    registerAuth({
      tenantId: orgSlug || orgId || "default",
      role: mapClerkRole(orgRole),
      userKey: userId || "anon",
      getToken: () => getToken(),
    });
  }, [isLoaded, isSignedIn, userId, orgId, orgSlug, orgRole, getToken, registerAuth]);

  return null;
}
