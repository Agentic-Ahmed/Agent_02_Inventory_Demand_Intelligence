/**
 * TypeScript mirrors of the FastAPI response models (backend/api/schemas.py +
 * routes). Kept 1:1 with the backend contract so the console can switch from
 * fixtures to the live API by setting NEXT_PUBLIC_API_BASE — nothing else changes.
 */
import type { AgentKey } from "@/lib/agents";

/** GET /api/usage -> UsageOut */
export interface Usage {
  tenant_id: string;
  agent_runs: number;
  total_tokens: number;
  tool_calls: number;
  escalations: number;
  approvals_resolved: number;
  tokens_by_agent: Partial<Record<AgentKey, number>>;
}

/** Action types a guardrail escalation can carry (orchestration._ACTION_TYPE). */
export type ActionType =
  | "purchase_order"
  | "markdown"
  | "stock_transfer"
  | "forecast_review"
  | "anomaly"
  | "review";

export type ApprovalStatus = "pending" | "approved" | "rejected";

/** GET /api/approvals -> ApprovalOut[] */
export interface Approval {
  id: string;
  tenant_id: string;
  action_type: ActionType;
  sku: string;
  summary: string;
  detail: Record<string, unknown>;
  required_role: string | null;
  status: ApprovalStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

/** POST /api/approvals/{id} body */
export interface ApprovalActionBody {
  action: "approve" | "reject";
  by: string;
  note?: string;
}

/** GET /api/audit -> AuditOut[] */
export interface AuditEvent {
  id: string;
  tenant_id: string;
  ts: string;
  event_type: string;
  actor: string;
  summary: string;
  detail: Record<string, unknown>;
}

/** GET /api/tenant thresholds block */
export interface TenantThresholds {
  po_auto_approve_limit: number;
  max_markdown: number;
  min_confidence: number;
  max_supplier_share: number;
  hard_po_ceiling: number;
  hard_markdown_ceiling: number;
}

/** GET /api/tenant -> the Settings payload */
export interface TenantInfo {
  tenant_id: string;
  name: string;
  thresholds: TenantThresholds;
  team: Record<string, { label: string; person: string }>;
  you: { role: string; label: string; can_approve: string[] };
}

/** POST /api/chat -> ChatResponse */
export interface ChatResponse {
  answer: string;
  tools_called: string[];
  escalations: string[];
}

/** SSE event shapes from POST /api/chat/stream (orchestration.run_orchestrator_stream). */
export type ChatStreamEvent =
  | { type: "tool_call"; tool: string }
  | { type: "tool_output"; specialist: string | null; status: string | null; escalation_id?: string }
  | { type: "text"; delta: string }
  | { type: "done"; answer: string; tools_called: string[]; escalations: string[] }
  | { type: "error"; detail: string };

/**
 * The caller's identity passed to the client. tenantId/role drive the dev
 * X-Tenant-Id / X-User-Role headers; getToken (present once Clerk is on) supplies
 * the verified session JWT sent as `Authorization: Bearer`.
 */
export interface Session {
  tenantId: string;
  role: string;
  getToken?: () => Promise<string | null>;
}
