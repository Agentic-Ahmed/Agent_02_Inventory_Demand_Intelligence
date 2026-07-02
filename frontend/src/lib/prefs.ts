/**
 * Per-tenant UI preferences (client-only, localStorage). Used by Settings sections
 * that have no backend endpoint yet (general display prefs, notification routing).
 * Object-shaped values only; merged over the provided fallback.
 */
export function getPrefs<T extends object>(tenantId: string, key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`quorum.prefs.${tenantId}.${key}`);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

export function setPrefs<T extends object>(tenantId: string, key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`quorum.prefs.${tenantId}.${key}`, JSON.stringify(value));
  } catch {
    /* ignore blocked storage */
  }
}
