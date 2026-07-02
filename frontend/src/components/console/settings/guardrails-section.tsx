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
import { cn } from "@/lib/utils";
import type { TenantInfo, TenantThresholds } from "@/lib/api/types";
import { SettingsCard, SectionHeader, Field } from "./ui";

type Kind = "money" | "percent";

interface FieldDef {
  key: keyof TenantThresholds;
  label: string;
  hint: string;
  kind: Kind;
  group: string;
}

const FIELDS: FieldDef[] = [
  { key: "po_auto_approve_limit", label: "Auto-approve PO limit", kind: "money", group: "Spend", hint: "Purchase orders below this auto-approve; above it they go to the approval inbox." },
  { key: "hard_po_ceiling", label: "Hard PO ceiling", kind: "money", group: "Spend", hint: "Agents can never auto-execute a purchase order above this — the guardrails can't override it." },
  { key: "max_markdown", label: "Max markdown depth", kind: "percent", group: "Markdown", hint: "Deepest markdown agents may apply without VP approval." },
  { key: "hard_markdown_ceiling", label: "Hard markdown ceiling", kind: "percent", group: "Markdown", hint: "Markdowns never exceed this, regardless of approval." },
  { key: "min_confidence", label: "Min forecast confidence", kind: "percent", group: "Forecast", hint: "Forecasts below this confidence are sent to human review." },
  { key: "max_supplier_share", label: "Max supplier share", kind: "percent", group: "Supplier", hint: "Max share of a category from one supplier before diversification is required." },
];

const toForm = (t: TenantThresholds, k: keyof TenantThresholds, kind: Kind) =>
  kind === "percent" ? String(Math.round(t[k] * 100)) : String(t[k]);

export function GuardrailsSection() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const query = useQuery(() => getTenant(session), [tenantId, role, clerkActive]);

  return (
    <div>
      <SectionHeader
        title="Guardrail thresholds"
        description="What agents may do autonomously before a human is asked. Hard ceilings can never be crossed."
      />
      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : query.loading && !query.data ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : query.data ? (
        <GuardrailsForm tenant={query.data} session={session} onSaved={query.refetch} />
      ) : null}
    </div>
  );
}

function GuardrailsForm({
  tenant,
  session,
  onSaved,
}: {
  tenant: TenantInfo;
  session: { tenantId: string; role: string; getToken?: () => Promise<string | null> };
  onSaved: () => void;
}) {
  const canEdit = tenant.you.role === "manager" || tenant.you.role === "admin";

  const initial = React.useMemo(() => {
    const f: Record<string, string> = {};
    for (const fld of FIELDS) f[fld.key] = toForm(tenant.thresholds, fld.key, fld.kind);
    return f;
  }, [tenant]);

  const [form, setForm] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setForm(initial), [initial]);

  const dirty = Object.keys(initial).some((k) => form[k] !== initial[k]);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const thresholds: Partial<TenantThresholds> = {};
      for (const fld of FIELDS) {
        const raw = Number(form[fld.key]);
        if (Number.isNaN(raw)) continue;
        thresholds[fld.key] = fld.kind === "percent" ? Math.min(100, Math.max(0, raw)) / 100 : Math.max(0, raw);
      }
      await updateTenant(session, { thresholds });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  const groups = [...new Set(FIELDS.map((f) => f.group))];

  return (
    <SettingsCard>
      <CardContent className="space-y-6 py-5">
        {groups.map((group) => (
          <fieldset key={group} className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.filter((f) => f.group === group).map((f) => (
                <Field key={f.key} label={f.label} htmlFor={f.key} hint={f.hint}>
                  <div className="relative">
                    {f.kind === "money" ? (
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    ) : null}
                    <Input
                      id={f.key}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={f.kind === "percent" ? 100 : undefined}
                      value={form[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      disabled={!canEdit || busy}
                      className={cn("tabular-nums", f.kind === "money" ? "pl-7" : "pr-8")}
                    />
                    {f.kind === "percent" ? (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    ) : null}
                  </div>
                </Field>
              ))}
            </div>
          </fieldset>
        ))}
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
          <Button onClick={save} disabled={!dirty || busy}>
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
