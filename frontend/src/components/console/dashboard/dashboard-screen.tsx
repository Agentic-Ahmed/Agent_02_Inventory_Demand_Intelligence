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
import { WorkspaceDataBanner } from "./workspace-data-banner";

export function DashboardScreen() {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const session = React.useMemo(
    () => ({ tenantId, role, getToken }),
    [tenantId, role, getToken],
  );

  const dash = useQuery(() => getDashboard(session), [tenantId, role, clerkActive]);
  const approvals = useQuery(() => getApprovals(session, "pending"), [tenantId, role, clerkActive]);
  const inventory = useQuery(() => getInventory(session), [tenantId, role, clerkActive]);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="What your agents did, what needs you, and where inventory stands."
      />

      <WorkspaceDataBanner />

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
