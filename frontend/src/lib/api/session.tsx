"use client";

import * as React from "react";

/**
 * The caller's identity for the console. Two sources, mirroring the backend:
 *   - Dev (no Clerk): tenant + role come from the in-app switcher, persisted to
 *     localStorage; onboarding is scoped per-browser ("anon").
 *   - Clerk on: <ClerkSessionBridge> calls registerAuth() with the verified
 *     org/role/user + a getToken(), which then override the dev values and the
 *     API client sends the token as a bearer.
 */
const STORAGE_KEY = "quorum.session";
const DEFAULT = { tenantId: "acme", role: "planner" };

type GetToken = () => Promise<string | null>;

interface AuthIdentity {
  tenantId: string;
  role: string;
  userKey: string;
  getToken: GetToken;
}

interface SessionCtx {
  tenantId: string;
  role: string;
  /** Onboarding scope: the signed-in user id, or "anon" in dev. */
  userKey: string;
  /** True once a Clerk identity is in effect (hides the dev switcher). */
  clerkActive: boolean;
  /** Bearer-token getter when Clerk is on; undefined in dev. */
  getToken?: GetToken;
  setTenant: (tenantId: string) => void;
  setRole: (role: string) => void;
  /** Called by the Clerk bridge; pass null on sign-out. */
  registerAuth: (identity: AuthIdentity | null) => void;
}

const Ctx = React.createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [dev, setDev] = React.useState(DEFAULT);
  const [auth, setAuth] = React.useState<AuthIdentity | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDev({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed/blocked storage */
    }
  }, []);

  const persist = React.useCallback((next: typeof DEFAULT) => {
    setDev(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const registerAuth = React.useCallback((identity: AuthIdentity | null) => {
    setAuth(identity);
  }, []);

  const clerkActive = auth !== null;

  const value = React.useMemo<SessionCtx>(
    () => ({
      tenantId: auth ? auth.tenantId : dev.tenantId,
      role: auth ? auth.role : dev.role,
      userKey: auth ? auth.userKey : "anon",
      clerkActive,
      getToken: auth ? auth.getToken : undefined,
      setTenant: (tenantId) => persist({ ...dev, tenantId }),
      setRole: (role) => persist({ ...dev, role }),
      registerAuth,
    }),
    [auth, dev, clerkActive, persist, registerAuth],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
