"use client";

import * as React from "react";
import { Check, Loader2, Lock } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getTenant, updateTenant } from "@/lib/api/client";
import { ErrorState } from "../page-shell";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPrefs, setPrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import type { TenantInfo } from "@/lib/api/types";
import { SettingsCard, SectionHeader, Field } from "./ui";

interface GeneralPrefs {
  currency: string;
  timezone: string;
}

const DEFAULT_PREFS: GeneralPrefs = { currency: "USD", timezone: "America/New_York" };

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "UTC",
];

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function GeneralSection() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const query = useQuery(() => getTenant(session), [tenantId, role, clerkActive]);

  return (
    <div>
      <SectionHeader title="General" description="Your workspace identity and display preferences." />
      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : query.loading && !query.data ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : query.data ? (
        <GeneralForm tenant={query.data} tenantId={tenantId} session={session} onSaved={query.refetch} />
      ) : null}
    </div>
  );
}

function GeneralForm({
  tenant,
  tenantId,
  session,
  onSaved,
}: {
  tenant: TenantInfo;
  tenantId: string;
  session: { tenantId: string; role: string; getToken?: () => Promise<string | null> };
  onSaved: () => void;
}) {
  const canEdit = tenant.you.role === "manager" || tenant.you.role === "admin";

  const [name, setName] = React.useState(tenant.name);
  const [prefs, setLocalPrefs] = React.useState<GeneralPrefs>(DEFAULT_PREFS);
  const [baseline, setBaseline] = React.useState<GeneralPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loaded = getPrefs(tenantId, "general", DEFAULT_PREFS);
    setLocalPrefs(loaded);
    setBaseline(loaded);
  }, [tenantId]);

  React.useEffect(() => setName(tenant.name), [tenant.name]);

  const dirty =
    name.trim() !== tenant.name || prefs.currency !== baseline.currency || prefs.timezone !== baseline.timezone;

  const patch = (p: Partial<GeneralPrefs>) => {
    setLocalPrefs((v) => ({ ...v, ...p }));
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (name.trim() && name.trim() !== tenant.name) {
        await updateTenant(session, { name: name.trim() });
        onSaved();
      }
      setPrefs(tenantId, "general", prefs);
      setBaseline(prefs);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard>
      <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
        <Field label="Workspace name" htmlFor="ws-name">
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            disabled={!canEdit || busy}
            maxLength={80}
          />
        </Field>
        <Field label="Workspace ID">
          <Input value={tenant.tenant_id} readOnly disabled className="font-mono" />
        </Field>
        <Field label="Currency" htmlFor="ws-currency" hint="Used for spend limits and money displays.">
          <select
            id="ws-currency"
            className={selectClass}
            value={prefs.currency}
            onChange={(e) => patch({ currency: e.target.value })}
            disabled={!canEdit || busy}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Time zone" htmlFor="ws-tz" hint="Used for schedules and timestamps.">
          <select
            id="ws-tz"
            className={selectClass}
            value={prefs.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
            disabled={!canEdit || busy}
          >
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
        {canEdit ? (
          <p className="text-sm text-muted-foreground">
            {error ? (
              <span className="text-critical">{error}</span>
            ) : saved && !dirty ? (
              <span className="inline-flex items-center gap-1.5 text-ok">
                <Check className="size-4" /> Saved
              </span>
            ) : dirty ? (
              "Unsaved changes"
            ) : (
              "All changes saved"
            )}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5" /> Read-only for your role
          </p>
        )}
        {canEdit ? (
          <Button onClick={save} disabled={!dirty || busy} className={cn(!dirty && "opacity-100")}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        ) : null}
      </div>
    </SettingsCard>
  );
}
