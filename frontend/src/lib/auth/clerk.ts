/**
 * Clerk activation flag + role mapping. Mirrors backend/core/auth.py so the
 * frontend and API agree on identity:
 *   - tenant  = the active Clerk Organization (slug, else id)
 *   - role    = the org role ("org:buyer" -> "buyer"), mapped to our ROLES
 *
 * Clerk turns on the moment NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set. Without it
 * the console stays on the dev session (tenant/role switcher + local onboarding).
 */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Secure by default. The open dev session (tenant/role switcher + header identity, with
// NO real sign-in) is a local-development convenience — it must never silently ship to
// production. It is allowed only in local dev, or when a deploy explicitly opts in via
// NEXT_PUBLIC_ALLOW_INSECURE_DEV_AUTH=true (a knowingly-public demo).
const isProduction = process.env.NODE_ENV === "production";
const allowInsecureAuth = process.env.NEXT_PUBLIC_ALLOW_INSECURE_DEV_AUTH === "true";

/** May the console run on the open dev session (no Clerk)? */
export const devAuthAllowed = !isProduction || allowInsecureAuth;

/** A production build shipped with neither Clerk configured nor the explicit opt-out:
 *  the console must fail CLOSED (show an "auth required" notice) rather than expose
 *  tenant data with no sign-in. */
export const authMisconfigured = !clerkEnabled && !devAuthAllowed;

const ROLES = ["planner", "buyer", "allocator", "pricer", "analyst", "manager", "admin"];

/** "org:buyer" / "buyer" -> one of our ROLES (matches backend map_clerk_role). */
export function mapClerkRole(orgRole?: string | null): string {
  if (!orgRole) return "planner";
  const name = orgRole.split(":").pop()!.toLowerCase();
  if (ROLES.includes(name)) return name;
  if (name === "owner" || name === "lead") return "manager";
  return "planner";
}
