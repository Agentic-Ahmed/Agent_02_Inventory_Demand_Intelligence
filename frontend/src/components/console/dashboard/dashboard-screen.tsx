"use client";

import * as React from "react";

import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getDashboard, getApprovals, getInventory } from "@/lib/api/client";
import { PageContainer, PageHeader, ErrorState } from "../page-shell";
import { KpiCards } from "./kpi-cards";
import { PendingApprovalsCard } from "./pending-approvals-card";
import { AgentsOnDuty } from "./agents-on-duty";
import { InventoryHealth } from "./inventory-health";

export function DashboardScreen() {
  const { tenantId, role } = useSession();
  const session = React.useMemo(() => ({ tenantId, role }), [tenantId, role]);

  const dash = useQuery(() => getDashboard(session), [tenantId, role]);
  const approvals = useQuery(() => getApprovals(session, "pending"), [tenantId, role]);
  const inventory = useQuery(() => getInventory(session), [tenantId, role]);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="What your agents did, what needs you, and where inventory stands."
      />

      {dash.error ? (
        <ErrorState message={dash.error.message} onRetry={dash.refetch} />
      ) : (
        <div className="space-y-6">
          <KpiCards data={dash.data} loading={dash.loading} />

          <div className="grid gap-6 lg:grid-cols-2">
            <PendingApprovalsCard items={approvals.data} loading={approvals.loading} />
            <AgentsOnDuty />
          </div>

          <InventoryHealth rows={inventory.data} loading={inventory.loading} />
        </div>
      )}
    </PageContainer>
  );
}
