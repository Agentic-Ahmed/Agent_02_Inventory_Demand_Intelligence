"use client";

import * as React from "react";
import {
  Warehouse,
  Factory,
  ShoppingCart,
  Database,
  MessageSquare,
  Radio,
  Check,
  Upload,
  RotateCcw,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";

import { useSession } from "@/lib/api/session";
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  importInventory,
  revertInventory,
} from "@/lib/api/client";
import type { Integration } from "@/lib/api/types";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SettingsCard, SectionHeader, Field } from "./ui";

interface Catalog {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  endpointLabel: string;
  secretLabel: string;
}

const CATALOG: Catalog[] = [
  { id: "wms", name: "Warehouse (WMS)", desc: "Live stock levels and inter-center transfers.", icon: Warehouse, endpointLabel: "WMS API URL", secretLabel: "API key" },
  { id: "erp", name: "Supplier ERP / EDI", desc: "Submit purchase orders and request quotes.", icon: Factory, endpointLabel: "ERP / EDI endpoint", secretLabel: "API key" },
  { id: "commerce", name: "Commerce platform", desc: "Apply markdowns and price changes.", icon: ShoppingCart, endpointLabel: "Store URL", secretLabel: "Access token" },
  { id: "warehouse_data", name: "Data warehouse", desc: "Historical sales and forecast logs.", icon: Database, endpointLabel: "Connection URL", secretLabel: "API key" },
  { id: "slack", name: "Slack", desc: "Route approval and anomaly alerts to a channel.", icon: MessageSquare, endpointLabel: "Webhook URL", secretLabel: "Signing secret" },
  { id: "events", name: "Event stream", desc: "Flash-sale and supplier-delay triggers (Kafka/Redpanda).", icon: Radio, endpointLabel: "Bootstrap servers", secretLabel: "SASL password" },
];

// ---- CSV -> rows ----

type ImportRow = { sku: string; name?: string; on_hand?: number; days_cover?: number; status?: string };

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const at = (name: string) => header.indexOf(name);
  const iSku = at("sku"), iName = at("name"), iOn = at("on_hand"), iDays = at("days_cover"), iStatus = at("status");
  const num = (v: string | undefined) => (v == null || v === "" ? undefined : Number(v));
  return lines
    .slice(1)
    .map((line) => {
      const c = line.split(",").map((x) => x.trim());
      return {
        sku: iSku >= 0 ? c[iSku] : c[0],
        name: iName >= 0 ? c[iName] : undefined,
        on_hand: num(iOn >= 0 ? c[iOn] : undefined),
        days_cover: num(iDays >= 0 ? c[iDays] : undefined),
        status: iStatus >= 0 ? c[iStatus] : undefined,
      };
    })
    .filter((r) => (r.sku ?? "").trim());
}

// ---- Import card ----

function ImportInventoryCard({ canManage }: { canManage: boolean }) {
  const { tenantId, role, getToken } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [imported, setImported] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) {
        setNote("No rows found. The file needs a header row with a 'sku' column.");
        return;
      }
      const res = await importInventory(session, rows);
      setImported(true);
      setNote(`Imported ${res.imported} SKUs. Your Inventory and Forecasts now use your data.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRevert() {
    setBusy(true);
    try {
      await revertInventory(session);
      setImported(false);
      setNote("Reverted to the default catalog.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard>
      <CardHeader className="border-b pb-4">
        <CardTitle>Import inventory</CardTitle>
        <CardDescription>
          Upload a CSV to power your Inventory table and forecasts. Columns:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">sku, name, on_hand, days_cover</code>{" "}
          (status optional — derived from days of cover).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 py-5">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          disabled={!canManage || busy}
          className="hidden"
        />
        <Button onClick={() => inputRef.current?.click()} disabled={!canManage || busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload CSV
        </Button>
        {imported ? (
          <Button variant="outline" onClick={onRevert} disabled={!canManage || busy}>
            <RotateCcw className="size-4" />
            Revert to default
          </Button>
        ) : null}
        {note ? (
          <p role="status" className="w-full text-sm text-muted-foreground">
            {note}
          </p>
        ) : null}
        {!canManage ? (
          <p className="w-full text-xs text-muted-foreground">
            Only an Inventory Manager or Admin can import data.
          </p>
        ) : null}
      </CardContent>
    </SettingsCard>
  );
}

// ---- One integration card (connect form / connected state) ----

function IntegrationCard({
  item,
  connected,
  canManage,
  onConnect,
  onDisconnect,
}: {
  item: Catalog;
  connected: Integration | undefined;
  canManage: boolean;
  onConnect: (kind: string, label: string, endpoint: string, secret: string) => Promise<void>;
  onDisconnect: (kind: string) => Promise<void>;
}) {
  const Icon = item.icon;
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [endpoint, setEndpoint] = React.useState("");
  const [secret, setSecret] = React.useState("");

  async function submit() {
    setBusy(true);
    try {
      await onConnect(item.id, item.name, endpoint, secret);
      setOpen(false);
      setEndpoint("");
      setSecret("");
    } finally {
      setBusy(false);
    }
  }

  const isConnected = !!connected;

  return (
    <SettingsCard>
      <CardContent className="flex h-full flex-col gap-3 py-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
            {isConnected && connected?.secret_hint ? (
              <p className="mt-1 text-xs text-muted-foreground">Key {connected.secret_hint}</p>
            ) : null}
          </div>
        </div>

        {open && !isConnected ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Field label={item.endpointLabel} htmlFor={`ep-${item.id}`}>
              <Input
                id={`ep-${item.id}`}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://…"
                autoComplete="off"
              />
            </Field>
            <Field label={item.secretLabel} htmlFor={`sk-${item.id}`}>
              <Input
                id={`sk-${item.id}`}
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
              />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Stored securely and shown masked — the key itself is never displayed again.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={busy || !secret}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save connection
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                <X className="size-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              isConnected ? "text-ok" : "text-muted-foreground",
            )}
          >
            <span className={cn("size-1.5 rounded-full", isConnected ? "bg-ok" : "bg-muted-foreground/50")} />
            {isConnected ? "Connected" : "Not connected"}
          </span>
          {isConnected ? (
            <Button variant="outline" size="sm" onClick={() => onDisconnect(item.id)} disabled={!canManage}>
              Disconnect
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={() => setOpen((v) => !v)} disabled={!canManage}>
              <Check className="size-4" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </SettingsCard>
  );
}

export function IntegrationsSection() {
  const { tenantId, role, getToken } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const canManage = role === "manager" || role === "admin";

  const [items, setItems] = React.useState<Integration[]>([]);

  const refresh = React.useCallback(async () => {
    try {
      setItems(await getIntegrations(session));
    } catch {
      setItems([]);
    }
  }, [session]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const byKind = React.useMemo(() => {
    const m = new Map<string, Integration>();
    for (const it of items) m.set(it.kind, it);
    return m;
  }, [items]);

  async function onConnect(kind: string, label: string, endpoint: string, secret: string) {
    await connectIntegration(session, {
      kind,
      label,
      config: endpoint ? { endpoint } : {},
      secret: secret || undefined,
    });
    await refresh();
  }

  async function onDisconnect(kind: string) {
    await disconnectIntegration(session, kind);
    await refresh();
  }

  const connectedCount = CATALOG.filter((c) => byKind.has(c.id)).length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Data & integrations"
        description="Bring your own data and connect the systems your agents act on."
      />

      <ImportInventoryCard canManage={canManage} />

      <div>
        <p className="mb-3 text-sm font-medium text-foreground">
          Connected systems{" "}
          <span className="font-normal text-muted-foreground">
            ({connectedCount} of {CATALOG.length})
          </span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CATALOG.map((it) => (
            <IntegrationCard
              key={it.id}
              item={it}
              connected={byKind.get(it.id)}
              canManage={canManage}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ))}
        </div>
      </div>

      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          Only an Inventory Manager or Admin can change integrations.
        </p>
      ) : null}
    </div>
  );
}
