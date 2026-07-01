import {
  Activity,
  Wrench,
  AlertTriangle,
  Gavel,
  Circle,
  type LucideIcon,
} from "lucide-react";

import { AGENTS, type AgentKey } from "@/lib/agents";
import type { AuditEvent } from "@/lib/api/types";

export type EventTone = "primary" | "muted" | "warn" | "ok";

/** Event-type styling for the timeline. Unknown types fall back to a neutral dot. */
const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: EventTone }> = {
  agent_run: { label: "Agent run", icon: Activity, tone: "primary" },
  tool_call: { label: "Tool call", icon: Wrench, tone: "muted" },
  escalation: { label: "Escalation", icon: AlertTriangle, tone: "warn" },
  approval_resolved: { label: "Approval", icon: Gavel, tone: "ok" },
};

function humanize(s: string): string {
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function eventMeta(type: string): { label: string; icon: LucideIcon; tone: EventTone } {
  return EVENT_META[type] ?? { label: humanize(type), icon: Circle, tone: "muted" };
}

const TONE_CLASS: Record<EventTone, string> = {
  primary: "bg-primary/15 text-primary",
  muted: "bg-muted text-muted-foreground",
  warn: "bg-warn/15 text-warn",
  ok: "bg-ok/15 text-ok",
};

export function toneClasses(tone: EventTone): string {
  return TONE_CLASS[tone];
}

/** An actor is either one of our agents (carry its identity color) or a person. */
export function resolveActor(actor: string): { name: string; isAgent: boolean; textClass?: string } {
  if (actor in AGENTS) {
    const a = AGENTS[actor as AgentKey];
    return { name: a.name, isAgent: true, textClass: a.text };
  }
  return { name: actor, isAgent: false };
}

/** Compact key/value pairs from an event's detail payload (log-style). */
export function detailEntries(detail: Record<string, unknown>): [string, string][] {
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => [k, String(v)]);
}

// ---- day grouping ----

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export interface DayGroup {
  label: string;
  events: AuditEvent[];
}

/** Group an already-sorted (newest-first) list into consecutive day buckets. */
export function groupByDay(events: AuditEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const label = dayLabel(event.ts);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}
