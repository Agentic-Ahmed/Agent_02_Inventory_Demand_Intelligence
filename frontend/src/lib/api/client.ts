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
  ChatStreamEvent,
  GeocodeHit,
  ImportResult,
  Integration,
  Invite,
  Session,
  SkuForecast,
  TenantInfo,
  TenantPatch,
  TenantThresholds,
  Usage,
} from "./types";
import { tenantFixture, type DashboardKpis, type InventoryRow } from "./fixtures";
import { buildForecast } from "./forecast";

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
  // When Clerk is on, send the verified session JWT; the backend reads identity
  // from it and ignores the dev headers (which stay for the no-auth dev path).
  const token = session.getToken ? await session.getToken() : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": session.tenantId,
      "X-User-Role": session.role,
      "X-User-Id": session.userId ?? "user",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    // Backend treats status=all as "no filter" (see routes/approvals.py).
    return apiFetch<Approval[]>(session, `/api/approvals?status=${status}`);
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

// In-session edits made on the Settings screen (fixtures/preview mode only). Live mode
// persists on the backend via PATCH /api/tenant; here saves survive refetch this session.
type TenantEdit = {
  name?: string;
  thresholds?: Partial<TenantThresholds>;
  signal_location?: TenantInfo["signal_location"] | null; // null = explicitly reset
};
const tenantEdits: Record<string, TenantEdit> = {};

const DEFAULT_SIGNAL_LOCATION = { latitude: 40.7128, longitude: -74.006, label: null, custom: false };

export async function getTenant(session: Session): Promise<TenantInfo> {
  if (IS_LIVE) return apiFetch<TenantInfo>(session, "/api/tenant");
  await fakeDelay();
  const t = tenantFixture(session.tenantId).tenant;
  const edit = tenantEdits[session.tenantId] ?? {};
  // Reflect the currently-selected role in `you` (fixtures store a default).
  const canApproveList = Object.entries(SPECIALIST_ROLE)
    .filter(([, owner]) => canApprove(session.role, owner))
    .map(([spec]) => spec);
  const signalLocation =
    edit.signal_location === null
      ? DEFAULT_SIGNAL_LOCATION
      : edit.signal_location ?? t.signal_location ?? DEFAULT_SIGNAL_LOCATION;
  return {
    ...t,
    name: edit.name ?? t.name,
    thresholds: { ...t.thresholds, ...edit.thresholds },
    signal_location: signalLocation,
    you: {
      role: session.role,
      label: ROLE_LABEL[session.role] ?? session.role,
      can_approve: canApproveList,
    },
  };
}

export async function updateTenant(session: Session, patch: TenantPatch): Promise<TenantInfo> {
  if (IS_LIVE) {
    return apiFetch<TenantInfo>(session, "/api/tenant", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }
  await fakeDelay();
  const prev = tenantEdits[session.tenantId] ?? {};
  const next: TenantEdit = {
    name: patch.name ?? prev.name,
    thresholds: { ...prev.thresholds, ...patch.thresholds },
    signal_location: prev.signal_location,
  };
  if (patch.reset_signal_location) {
    next.signal_location = null;
  } else if (patch.signal_latitude != null && patch.signal_longitude != null) {
    next.signal_location = {
      latitude: patch.signal_latitude,
      longitude: patch.signal_longitude,
      label: patch.signal_location_label ?? null,
      custom: true,
    };
  }
  tenantEdits[session.tenantId] = next;
  return getTenant(session);
}

/** City/place search for the per-tenant weather location (Settings -> General). */
export async function geocodeLocation(session: Session, q: string): Promise<GeocodeHit[]> {
  const query = q.trim();
  if (!query) return [];
  if (IS_LIVE) {
    const out = await apiFetch<{ query: string; results: GeocodeHit[] }>(
      session,
      `/api/signals/geocode?q=${encodeURIComponent(query)}`,
    );
    return out.results ?? [];
  }
  // Fixtures/preview: hit Open-Meteo's free geocoding directly (no key, no backend).
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: GeocodeHit[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ---- team invites (Settings -> Team & roles -> Invite teammate) ----

// Fixtures-mode pending invites (kept in-session) so the flow works with no backend.
const fixtureInvites: Record<string, Invite[]> = {};

export async function getInvites(
  session: Session,
  status: "pending" | "all" = "pending",
): Promise<Invite[]> {
  if (IS_LIVE) return apiFetch<Invite[]>(session, `/api/team/invites?status=${status}`);
  await fakeDelay();
  const all = fixtureInvites[session.tenantId] ?? [];
  return status === "all" ? all : all.filter((i) => i.status === "pending");
}

export async function createInvite(
  session: Session,
  body: { email: string; roles: string[] },
): Promise<Invite> {
  if (IS_LIVE) {
    return apiFetch<Invite>(session, "/api/team/invites", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  await fakeDelay();
  const item: Invite = {
    id: Math.random().toString(36).slice(2, 14),
    tenant_id: session.tenantId,
    email: body.email,
    roles: body.roles,
    invited_by: session.role,
    status: "pending",
    created_at: new Date().toISOString(),
    revoked_at: null,
    email_sent: false,
  };
  (fixtureInvites[session.tenantId] ??= []).unshift(item);
  return item;
}

export async function revokeInvite(session: Session, id: string): Promise<Invite | null> {
  if (IS_LIVE) return apiFetch<Invite>(session, `/api/team/invites/${id}`, { method: "DELETE" });
  await fakeDelay();
  const item = (fixtureInvites[session.tenantId] ?? []).find((i) => i.id === id);
  if (item) {
    item.status = "revoked";
    item.revoked_at = new Date().toISOString();
  }
  return item ?? null;
}

export async function getDashboard(session: Session): Promise<DashboardKpis> {
  if (IS_LIVE) return apiFetch<DashboardKpis>(session, "/api/dashboard");
  await fakeDelay();
  return tenantFixture(session.tenantId).dashboard;
}

export async function getInventory(session: Session): Promise<InventoryRow[]> {
  if (IS_LIVE) return apiFetch<InventoryRow[]>(session, "/api/inventory");
  await fakeDelay();
  // Preview: a tenant's imported rows override the seeded catalog, mirroring the backend.
  return importedInventory[session.tenantId] ?? tenantFixture(session.tenantId).inventory;
}

export async function getForecasts(session: Session): Promise<SkuForecast[]> {
  if (IS_LIVE) return apiFetch<SkuForecast[]>(session, "/api/forecasts");
  // Fixtures: derive from inventory so preview stays consistent (see forecast.ts).
  await fakeDelay();
  const rows = importedInventory[session.tenantId] ?? tenantFixture(session.tenantId).inventory;
  return rows.map(buildForecast);
}

// ---- integrations + data import (Settings -> Integrations) ----

// Preview-mode stores (in-session), so connect/import work without a backend.
const integrationsStore: Record<string, Integration[]> = {};
const importedInventory: Record<string, InventoryRow[]> = {};

const STATUS_FOR = (daysCover: number): InventoryRow["status"] =>
  daysCover <= 1 ? "critical" : daysCover <= 3 ? "low" : daysCover >= 60 ? "overstock" : "healthy";

export async function getIntegrations(session: Session): Promise<Integration[]> {
  if (IS_LIVE) return apiFetch<Integration[]>(session, "/api/integrations");
  await fakeDelay();
  return integrationsStore[session.tenantId] ?? [];
}

export async function connectIntegration(
  session: Session,
  body: { kind: string; label?: string; config?: Record<string, unknown>; secret?: string },
): Promise<Integration> {
  if (IS_LIVE) {
    return apiFetch<Integration>(session, "/api/integrations", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  await fakeDelay();
  const now = new Date().toISOString();
  const hint = body.secret ? `****${body.secret.slice(-4)}` : null;
  const item: Integration = {
    id: Math.random().toString(36).slice(2, 14),
    tenant_id: session.tenantId,
    kind: body.kind,
    label: body.label || body.kind,
    config: body.config ?? {},
    secret_hint: hint,
    status: "connected",
    created_at: now,
    updated_at: now,
  };
  const list = (integrationsStore[session.tenantId] ??= []);
  const idx = list.findIndex((i) => i.kind === body.kind);
  if (idx >= 0) list[idx] = { ...item, id: list[idx].id, created_at: list[idx].created_at };
  else list.push(item);
  return item;
}

export async function disconnectIntegration(session: Session, kind: string): Promise<void> {
  if (IS_LIVE) {
    await apiFetch<{ disconnected: boolean }>(session, `/api/integrations/${kind}`, { method: "DELETE" });
    return;
  }
  await fakeDelay();
  const list = integrationsStore[session.tenantId] ?? [];
  integrationsStore[session.tenantId] = list.filter((i) => i.kind !== kind);
}

export async function importInventory(
  session: Session,
  rows: Array<{ sku: string; name?: string; on_hand?: number; days_cover?: number; status?: string }>,
): Promise<ImportResult> {
  if (IS_LIVE) {
    return apiFetch<ImportResult>(session, "/api/inventory/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  }
  await fakeDelay();
  const cleaned: InventoryRow[] = rows
    .filter((r) => (r.sku ?? "").trim())
    .map((r) => {
      const daysCover = Math.max(0, Math.floor(Number(r.days_cover) || 0));
      const status = (["healthy", "low", "critical", "overstock"] as const).includes(
        r.status as InventoryRow["status"],
      )
        ? (r.status as InventoryRow["status"])
        : STATUS_FOR(daysCover);
      return {
        sku: String(r.sku).trim(),
        name: (r.name ?? r.sku).toString().trim(),
        on_hand: Math.max(0, Math.floor(Number(r.on_hand) || 0)),
        days_cover: daysCover,
        status,
      };
    });
  importedInventory[session.tenantId] = cleaned;
  return { imported: cleaned.length, source: "import" };
}

export async function revertInventory(session: Session): Promise<void> {
  if (IS_LIVE) {
    await apiFetch<{ reverted: boolean }>(session, "/api/inventory/import", { method: "DELETE" });
    return;
  }
  await fakeDelay();
  delete importedInventory[session.tenantId];
}

// ---- chat (SSE streaming) ----

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse one SSE frame ("event: <type>\ndata: <json>") into a ChatStreamEvent. */
function parseSseFrame(frame: string): ChatStreamEvent | null {
  let type = "";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!type) return null;
  let payload: Record<string, unknown> = {};
  if (data) {
    try {
      payload = JSON.parse(data);
    } catch {
      /* ignore malformed frame */
    }
  }
  return { type, ...payload } as ChatStreamEvent;
}

/**
 * Stream one orchestrator turn. Emits tool_call / tool_output / text / done / error
 * events to `onEvent`. Live: POST /api/chat/stream (SSE over fetch). Fixtures: a
 * short simulated turn so the panel works offline.
 */
export async function streamChat(
  session: Session,
  message: string,
  sku: string,
  onEvent: (ev: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!IS_LIVE) return simulateChat(onEvent, signal);

  let res: Response;
  try {
    const token = session.getToken ? await session.getToken() : null;
    res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": session.tenantId,
        "X-User-Role": session.role,
        "X-User-Id": session.userId ?? "user",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, sku }),
      signal,
    });
  } catch (err) {
    onEvent({ type: "error", detail: err instanceof Error ? err.message : "network error" });
    return;
  }
  if (!res.ok || !res.body) {
    const body = res.body ? await res.text().catch(() => "") : "";
    onEvent({ type: "error", detail: `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 160)}` : ""}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const ev = parseSseFrame(frame);
        if (ev) onEvent(ev);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      onEvent({ type: "error", detail: err instanceof Error ? err.message : "stream error" });
    }
  }
}

async function simulateChat(onEvent: (ev: ChatStreamEvent) => void, signal?: AbortSignal): Promise<void> {
  const steps: ChatStreamEvent[] = [
    { type: "tool_call", tool: "get_sales_history" },
    { type: "tool_output", specialist: "forecasting", status: "ok" },
    { type: "tool_call", tool: "get_current_inventory" },
    { type: "tool_output", specialist: "reorder", status: "ok" },
  ];
  const answer =
    "Demo mode: I can't reach the orchestrator, so here's the shape of a real reply — I'd pull recent sales and on-hand stock, forecast demand, and flag any reorder above your limit for approval. Set NEXT_PUBLIC_API_BASE to the FastAPI URL for live answers.";
  for (const s of steps) {
    if (signal?.aborted) return;
    onEvent(s);
    await sleep(400);
  }
  const words = answer.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) return;
    onEvent({ type: "text", delta: (i ? " " : "") + words[i] });
    await sleep(28);
  }
  onEvent({
    type: "done",
    answer,
    tools_called: ["get_sales_history", "get_current_inventory"],
    escalations: [],
  });
}

export type { DashboardKpis, InventoryRow };
export type { SkuForecast } from "./types";
