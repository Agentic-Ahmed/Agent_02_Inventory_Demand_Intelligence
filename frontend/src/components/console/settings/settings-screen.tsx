"use client";

import * as React from "react";
import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getTenant, updateTenant, ROLE_LABEL } from "@/lib/api/client";
import { PageContainer, PageHeader, ErrorState } from "../page-shell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TenantInfo, TenantThresholds } from "@/lib/api/types";

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
  { key: "hard_po_ceiling", label: "Hard PO ceiling", kind: "money", group: "Spend", hint: "Agents can never auto-execute a purchase order above this — even the guardrails can't override it." },
  { key: "max_markdown", label: "Max markdown depth", kind: "percent", group: "Markdown", hint: "Deepest markdown agents may apply without VP approval." },
  { key: "hard_markdown_ceiling", label: "Hard markdown ceiling", kind: "percent", group: "Markdown", hint: "Markdowns never exceed this, regardless of approval." },
  { key: "min_confidence", label: "Min forecast confidence", kind: "percent", group: "Forecast", hint: "Forecasts below this confidence are sent to human review." },
  { key: "max_supplier_share", label: "Max supplier share", kind: "percent", group: "Supplier", hint: "Max share of a category from one supplier before diversification is required." },
];

const toForm = (t: TenantThresholds, k: keyof TenantThresholds, kind: Kind) =>
  kind === "percent" ? String(Math.round(t[k] * 100)) : String(t[k]);

export function SettingsScreen() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const query = useQuery(() => getTenant(session), [tenantId, role, clerkActive]);

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Your workspace, guardrail thresholds, and approval authority."
      >
        {query.data ? (
          <Badge variant="secondary">Acting as {ROLE_LABEL[query.data.you.role] ?? query.data.you.role}</Badge>
        ) : null}
      </PageHeader>

      {query.error ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : query.loading && !query.data ? (
        <SettingsSkeleton />
      ) : query.data ? (
        <SettingsForm tenant={query.data} session={session} onSaved={query.refetch} />
      ) : null}
    </PageContainer>
  );
}

function SettingsForm({
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
    const f: Record<string, string> = { name: tenant.name };
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
      await updateTenant(session, { name: form.name.trim() || tenant.name, thresholds });
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
    <div className="space-y-6">
      {/* Workspace */}
      <Card className="glass bg-white/60 gap-0 dark:bg-white/10">
        <CardHeader className="border-b pb-4">
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Your team&rsquo;s isolated tenant. All data stays scoped to it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
          <Field label="Workspace name" htmlFor="ws-name">
            <Input
              id="ws-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={!canEdit || busy}
              maxLength={80}
            />
          </Field>
          <Field label="Workspace ID">
            <Input value={tenant.tenant_id} readOnly disabled className="font-mono" />
          </Field>
        </CardContent>
      </Card>

      {/* Guardrail thresholds */}
      <Card className="glass bg-white/60 gap-0 dark:bg-white/10">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Guardrail thresholds
          </CardTitle>
          <CardDescription>
            {canEdit
              ? "What agents may do autonomously before a human is asked. Hard ceilings can never be crossed."
              : "What agents may do autonomously. Only an Inventory Manager or Admin can change these."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-4">
          {groups.map((group) => (
            <fieldset key={group} className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.filter((f) => f.group === group).map((f) => (
                  <Field key={f.key} label={f.label} htmlFor={f.key} hint={f.hint}>
                    <div className="relative">
                      {f.kind === "money" ? (
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
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
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
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
              <Lock className="size-3.5" />
              Read-only for your role
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
      </Card>

      {/* Team & authority */}
      <Card className="glass bg-white/60 gap-0 dark:bg-white/10">
        <CardHeader className="border-b pb-4">
          <CardTitle>Team &amp; authority</CardTitle>
          <CardDescription>Who holds each role, and what you can approve.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-4">
          {Object.keys(tenant.team).length > 0 ? (
            <ul role="list" className="divide-y divide-border/60">
              {Object.entries(tenant.team).map(([r, m]) => (
                <li key={r} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-medium text-foreground">{m.person}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Just you for now — invite teammates from your organization menu to fill these roles.
            </p>
          )}

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm">
              You are the <span className="font-medium text-foreground">{tenant.you.label}</span>.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tenant.you.can_approve.length > 0 ? (
                tenant.you.can_approve.map((s) => (
                  <Badge key={s} variant="outline" className="capitalize">
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No approval authority for your role.</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}
