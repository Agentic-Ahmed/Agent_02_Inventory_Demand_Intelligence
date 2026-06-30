/**
 * Console data client. One seam between the UI and the backend:
 *   - NEXT_PUBLIC_API_BASE unset  -> serve from fixtures (preview/offline).
 *   - NEXT_PUBLIC_API_BASE set     -> call the FastAPI backend, sending the dev
 *     identity headers (X-Tenant-Id / X-User-Role) until Clerk is switched on.
 *
 * Role helpers mirror backend/core/roles.py so approval gating in the UI matches
 * what the server will enforce.
 */
import type {
  Approval,
  ApprovalActionBody,
  ApprovalStatus,
  AuditEvent,
  Session,
  TenantInfo,
  Usage,
} from "./types";
import { tenantFixture, type DashboardKpis, type InventoryRow } from "./fixtures";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "");
export const IS_LIVE = Boolean(API_BASE);

// ---- role authority (mirror of backend/core/roles.py) ----

export const ROLE_LABEL: Record<string, string> = {
  planner: "Demand Planner",
  buyer: "Buyer",
  allocator: "Allocation Manager",
  pricer: "Pricing Manager",
  analyst: "Analyst",
  manager: "Inventory Manager",
  admin: "Admin",
};

export const ROLES = Object.keys(ROLE_LABEL);

const SPECIALIST_ROLE: Record<string, string> = {
  forecasting: "planner",
  reorder: "buyer",
  warehouse: "allocator",
  markdown: "pricer",
  anomaly: "analyst",
};

/** A user may approve if they own the agent that raised it, or are the manager. */
export function canApprove(role: string, requiredRole: string | null): boolean {
  if (role === "manager") return true;
  if (!requiredRole) return false;
  return role === requiredRole;
}

// ---- live fetch helper ----

async function apiFetch<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": session.tenantId,
      "X-User-Role": session.role,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

// Simulate network latency in fixtures mode so loading states are exercised.
const fakeDelay = () => new Promise((r) => setTimeout(r, 220));

// ---- endpoints ----

export async function getUsage(session: Session): Promise<Usage> {
  if (IS_LIVE) return apiFetch<Usage>(session, "/api/usage");
  await fakeDelay();
  return tenantFixture(session.tenantId).usage;
}

export async function getApprovals(
  session: Session,
  status: ApprovalStatus | "all" = "pending",
): Promise<Approval[]> {
  if (IS_LIVE) {
    const q = status === "all" ? "" : `?status=${status}`;
    return apiFetch<Approval[]>(session, `/api/approvals${q}`);
  }
  await fakeDelay();
  const all = tenantFixture(session.tenantId).approvals;
  return status === "all" ? all : all.filter((a) => a.status === status);
}

export async function resolveApproval(
  session: Session,
  id: string,
  body: ApprovalActionBody,
): Promise<Approval> {
  if (IS_LIVE) {
    return apiFetch<Approval>(session, `/api/approvals/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  await fakeDelay();
  const items = tenantFixture(session.tenantId).approvals;
  const item = items.find((a) => a.id === id);
  if (!item) throw new Error("approval item not found");
  // Mutate the fixture so the change persists across navigation this session.
  item.status = body.action === "approve" ? "approved" : "rejected";
  item.resolved_at = new Date().toISOString();
  item.resolved_by = body.by;
  return item;
}

export async function getAudit(session: Session, limit = 100): Promise<AuditEvent[]> {
  if (IS_LIVE) return apiFetch<AuditEvent[]>(session, `/api/audit?limit=${limit}`);
  await fakeDelay();
  return tenantFixture(session.tenantId).audit.slice(0, limit);
}

export async function getTenant(session: Session): Promise<TenantInfo> {
  if (IS_LIVE) return apiFetch<TenantInfo>(session, "/api/tenant");
  await fakeDelay();
  const t = tenantFixture(session.tenantId).tenant;
  // Reflect the currently-selected role in `you` (fixtures store a default).
  const canApproveList = Object.entries(SPECIALIST_ROLE)
    .filter(([, owner]) => canApprove(session.role, owner))
    .map(([spec]) => spec);
  return {
    ...t,
    you: {
      role: session.role,
      label: ROLE_LABEL[session.role] ?? session.role,
      can_approve: canApproveList,
    },
  };
}

export async function getDashboard(session: Session): Promise<DashboardKpis> {
  // Backend has no KPI endpoint yet; always fixture-backed (see fixtures.ts note).
  await fakeDelay();
  return tenantFixture(session.tenantId).dashboard;
}

export async function getInventory(session: Session): Promise<InventoryRow[]> {
  await fakeDelay();
  return tenantFixture(session.tenantId).inventory;
}

export type { DashboardKpis, InventoryRow };
