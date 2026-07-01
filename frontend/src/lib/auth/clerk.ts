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

const ROLES = ["planner", "buyer", "allocator", "pricer", "analyst", "manager", "admin"];

/** "org:buyer" / "buyer" -> one of our ROLES (matches backend map_clerk_role). */
export function mapClerkRole(orgRole?: string | null): string {
  if (!orgRole) return "planner";
  const name = orgRole.split(":").pop()!.toLowerCase();
  if (ROLES.includes(name)) return name;
  if (name === "owner" || name === "lead") return "manager";
  return "planner";
}
