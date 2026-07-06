"use client";

import * as React from "react";
import { Check, Loader2, Lock, MapPin, RotateCcw, Search } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getTenant, updateTenant, geocodeLocation } from "@/lib/api/client";
import { ErrorState } from "../page-shell";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPrefs, setPrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import type { GeocodeHit, TenantInfo } from "@/lib/api/types";
import { SettingsCard, SectionHeader, Field } from "./ui";

type SectionSession = { tenantId: string; role: string; getToken?: () => Promise<string | null> };

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
        <div className="space-y-4">
          <GeneralForm tenant={query.data} tenantId={tenantId} session={session} onSaved={query.refetch} />
          <WeatherLocationCard tenant={query.data} session={session} onSaved={query.refetch} />
        </div>
      ) : null}
    </div>
  );
}

function formatHit(hit: GeocodeHit): string {
  return [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");
}

function WeatherLocationCard({
  tenant,
  session,
  onSaved,
}: {
  tenant: TenantInfo;
  session: SectionSession;
  onSaved: () => void;
}) {
  const canEdit = tenant.you.role === "manager" || tenant.you.role === "admin";
  const loc = tenant.signal_location;

  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<GeocodeHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const current =
    loc?.custom && loc.label
      ? loc.label
      : loc
        ? `${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}`
        : "Default";

  async function search() {
    const query = q.trim();
    if (!query) return;
    setSearching(true);
    setNote(null);
    try {
      const hits = await geocodeLocation(session, query);
      setResults(hits);
      if (!hits.length) setNote(`No places found for “${query}”.`);
    } catch {
      setNote("Location search is unavailable right now.");
    } finally {
      setSearching(false);
    }
  }

  async function choose(hit: GeocodeHit) {
    if (hit.latitude == null || hit.longitude == null) return;
    const key = `${hit.latitude},${hit.longitude}`;
    setSavingKey(key);
    setNote(null);
    try {
      await updateTenant(session, {
        signal_latitude: hit.latitude,
        signal_longitude: hit.longitude,
        signal_location_label: formatHit(hit),
      });
      setResults([]);
      setQ("");
      setNote(`Weather signal now reads from ${formatHit(hit)}.`);
      onSaved();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save location.");
    } finally {
      setSavingKey(null);
    }
  }

  async function reset() {
    setSavingKey("reset");
    setNote(null);
    try {
      await updateTenant(session, { reset_signal_location: true });
      setResults([]);
      setNote("Reverted to the default location.");
      onSaved();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not reset location.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <SettingsCard>
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> Weather signal location
        </CardTitle>
        <CardDescription>
          The forecasting agent reads live weather here to anticipate demand — a cold snap lifts
          warm-apparel demand, a heatwave lifts cold-drink demand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Current:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 font-medium text-foreground">
            <MapPin className="size-3.5 text-muted-foreground" />
            {current}
            <span className="text-xs font-normal text-muted-foreground">
              {loc?.custom ? "(custom)" : "(default)"}
            </span>
          </span>
        </div>

        {canEdit ? (
          <Field label="Change location" htmlFor="wx-city" hint="Search by city or place name.">
            <div className="flex gap-2">
              <Input
                id="wx-city"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void search();
                  }
                }}
                placeholder="e.g. London, Tokyo, São Paulo"
                autoComplete="off"
              />
              <Button variant="outline" onClick={search} disabled={searching || !q.trim()}>
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Search
              </Button>
            </div>
          </Field>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5" /> Read-only for your role
          </p>
        )}

        {results.length ? (
          <ul role="list" className="divide-y rounded-lg border">
            {results.map((hit) => {
              const key = `${hit.latitude},${hit.longitude}`;
              const saving = savingKey === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => choose(hit)}
                    disabled={!!savingKey}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                      {formatHit(hit)}
                    </span>
                    {saving ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Check className="size-4 text-muted-foreground opacity-0" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {canEdit && loc?.custom ? (
            <Button variant="ghost" size="sm" onClick={reset} disabled={savingKey === "reset"}>
              {savingKey === "reset" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Reset to default
            </Button>
          ) : null}
          {note ? (
            <p role="status" className="text-sm text-muted-foreground">
              {note}
            </p>
          ) : null}
        </div>
      </CardContent>
    </SettingsCard>
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
