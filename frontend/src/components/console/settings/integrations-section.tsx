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
  type LucideIcon,
} from "lucide-react";

import { useSession } from "@/lib/api/session";
import { getPrefs, setPrefs } from "@/lib/prefs";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsCard, SectionHeader } from "./ui";

interface Integration {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
}

const INTEGRATIONS: Integration[] = [
  { id: "wms", name: "Warehouse (WMS)", desc: "Live stock levels and inter-center transfers.", icon: Warehouse },
  { id: "erp", name: "Supplier ERP / EDI", desc: "Submit purchase orders and request quotes.", icon: Factory },
  { id: "commerce", name: "Commerce platform", desc: "Apply markdowns and price changes.", icon: ShoppingCart },
  { id: "warehouse_data", name: "Data warehouse", desc: "Historical sales and forecast logs.", icon: Database },
  { id: "slack", name: "Slack", desc: "Route approval and anomaly alerts to a channel.", icon: MessageSquare },
  { id: "events", name: "Event stream", desc: "Flash-sale and supplier-delay triggers (Kafka/Redpanda).", icon: Radio },
];

type ConnectState = Record<string, boolean>;
const DEFAULT_STATE: ConnectState = { wms: true, warehouse_data: true, slack: true };

export function IntegrationsSection() {
  const { tenantId, role } = useSession();
  const canManage = role === "manager" || role === "admin";
  const [state, setState] = React.useState<ConnectState>(DEFAULT_STATE);

  React.useEffect(() => {
    setState(getPrefs(tenantId, "integrations", DEFAULT_STATE));
  }, [tenantId]);

  const toggle = (id: string) => {
    setState((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      setPrefs(tenantId, "integrations", updated);
      return updated;
    });
  };

  const connectedCount = INTEGRATIONS.filter((i) => state[i.id]).length;

  return (
    <div>
      <SectionHeader
        title="Integrations"
        description={`Connect the systems your agents act on. ${connectedCount} of ${INTEGRATIONS.length} connected.`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((it) => {
          const connected = !!state[it.id];
          const Icon = it.icon;
          return (
            <SettingsCard key={it.id}>
              <CardContent className="flex h-full flex-col gap-3 py-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{it.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium",
                      connected ? "text-ok" : "text-muted-foreground",
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", connected ? "bg-ok" : "bg-muted-foreground/50")} />
                    {connected ? "Connected" : "Not connected"}
                  </span>
                  <Button
                    variant={connected ? "outline" : "default"}
                    size="sm"
                    onClick={() => toggle(it.id)}
                    disabled={!canManage}
                  >
                    {connected ? (
                      "Disconnect"
                    ) : (
                      <>
                        <Check className="size-4" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </SettingsCard>
          );
        })}
      </div>
      {!canManage ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Only an Inventory Manager or Admin can change integrations.
        </p>
      ) : null}
    </div>
  );
}
