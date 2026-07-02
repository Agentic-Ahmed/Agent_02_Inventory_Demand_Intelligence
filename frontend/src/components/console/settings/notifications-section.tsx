"use client";

import * as React from "react";
import { Mail, MessageSquare } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { getPrefs, setPrefs } from "@/lib/prefs";
import { CardContent } from "@/components/ui/card";
import { SettingsCard, SectionHeader, Toggle } from "./ui";

interface Channels {
  email: boolean;
  slack: boolean;
}
type NotifyPrefs = Record<string, Channels>;

const EVENTS: { key: string; label: string; hint: string }[] = [
  { key: "approvals", label: "Approval requests", hint: "A money action needs your sign-off." },
  { key: "escalations", label: "Escalations", hint: "An agent handed a decision to a human." },
  { key: "anomalies", label: "Anomaly alerts", hint: "Unusual demand or inventory signals." },
  { key: "forecasts", label: "Low-confidence forecasts", hint: "Forecasts below the review threshold." },
  { key: "digest", label: "Weekly digest", hint: "A summary of what your agents did." },
];

const DEFAULT_PREFS: NotifyPrefs = {
  approvals: { email: true, slack: true },
  escalations: { email: true, slack: true },
  anomalies: { email: false, slack: true },
  forecasts: { email: true, slack: false },
  digest: { email: true, slack: false },
};

export function NotificationsSection() {
  const { tenantId } = useSession();
  const [prefs, setLocal] = React.useState<NotifyPrefs>(DEFAULT_PREFS);
  const [savedTick, setSavedTick] = React.useState(false);

  React.useEffect(() => {
    setLocal(getPrefs(tenantId, "notifications", DEFAULT_PREFS));
  }, [tenantId]);

  const toggle = (event: string, channel: keyof Channels, next: boolean) => {
    setLocal((prev) => {
      const updated = { ...prev, [event]: { ...prev[event], [channel]: next } };
      setPrefs(tenantId, "notifications", updated);
      return updated;
    });
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 1500);
  };

  return (
    <div>
      <SectionHeader
        title="Notifications"
        description="Where each kind of event reaches you. Changes save automatically."
      />
      <SettingsCard>
        <CardContent className="py-2">
          {/* column headers */}
          <div className="hidden grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b py-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Event</span>
            <span className="flex items-center justify-center gap-1">
              <Mail className="size-3.5" /> Email
            </span>
            <span className="flex items-center justify-center gap-1">
              <MessageSquare className="size-3.5" /> Slack
            </span>
          </div>

          <ul role="list" className="divide-y divide-border/60">
            {EVENTS.map((e) => {
              const ch = prefs[e.key] ?? { email: false, slack: false };
              return (
                <li
                  key={e.key}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[1fr_5rem_5rem]"
                >
                  <div className="min-w-0 row-start-1">
                    <p className="text-sm font-medium text-foreground">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{e.hint}</p>
                  </div>
                  <div className="col-start-2 row-start-1 flex items-center gap-6 sm:contents">
                    <span className="flex justify-center sm:col-start-2">
                      <span className="sm:hidden mr-2 text-xs text-muted-foreground">Email</span>
                      <Toggle
                        checked={ch.email}
                        onChange={(v) => toggle(e.key, "email", v)}
                        label={`${e.label} by email`}
                      />
                    </span>
                    <span className="flex justify-center sm:col-start-3">
                      <span className="sm:hidden mr-2 text-xs text-muted-foreground">Slack</span>
                      <Toggle
                        checked={ch.slack}
                        onChange={(v) => toggle(e.key, "slack", v)}
                        label={`${e.label} on Slack`}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
        <div className="border-t px-6 py-3 text-xs text-muted-foreground" aria-live="polite">
          {savedTick ? <span className="text-ok">Saved</span> : "Delivery uses the channels connected under Integrations."}
        </div>
      </SettingsCard>
    </div>
  );
}
