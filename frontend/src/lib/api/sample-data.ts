/**
 * Per-tenant "sample data" switch (client-only, localStorage).
 *
 * A freshly provisioned workspace starts empty (see `emptyFixture`). This flag
 * lets a user load the demo dataset into their empty workspace to explore what a
 * populated console looks like, then clear it again. It only affects fixture mode
 * — with a live API (`NEXT_PUBLIC_API_BASE`) the backend is the source of truth.
 *
 * Pure, window-guarded functions so they're safe to call from the data layer;
 * the reactive hook lives in the banner component.
 */
const storageKey = (tenantId: string) => `quorum.sample.${tenantId}`;

export function isSampleData(tenantId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(tenantId)) === "1";
  } catch {
    return false;
  }
}

export function setSampleData(tenantId: string, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(storageKey(tenantId), "1");
    else window.localStorage.removeItem(storageKey(tenantId));
  } catch {
    /* ignore blocked storage */
  }
}
