"use client";

import * as React from "react";
import type { Session } from "./types";

/**
 * The caller's dev identity (tenant + role), persisted to localStorage. Drives
 * the X-Tenant-Id / X-User-Role headers in live mode and fixture selection
 * offline. Swapped out for Clerk's session once auth is switched on (CLAUDE.md S2).
 */
const STORAGE_KEY = "quorum.session";
const DEFAULT: Session = { tenantId: "acme", role: "planner" };

interface SessionCtx extends Session {
  setTenant: (tenantId: string) => void;
  setRole: (role: string) => void;
}

const Ctx = React.createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session>(DEFAULT);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSession({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed/blocked storage */
    }
  }, []);

  const persist = React.useCallback((next: Session) => {
    setSession(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<SessionCtx>(
    () => ({
      ...session,
      setTenant: (tenantId) => persist({ ...session, tenantId }),
      setRole: (role) => persist({ ...session, role }),
    }),
    [session, persist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
