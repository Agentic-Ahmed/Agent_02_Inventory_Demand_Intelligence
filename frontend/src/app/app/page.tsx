import type { Metadata } from "next";

import { DashboardScreen } from "@/components/console/dashboard/dashboard-screen";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Inventory KPIs, approvals, and agent activity.",
};

export default function DashboardPage() {
  return <DashboardScreen />;
}
