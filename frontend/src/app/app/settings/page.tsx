import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { ComingSoon } from "@/components/console/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Settings"
      description="Per-tenant guardrail thresholds, your team, and approval authority."
      note="The thresholds editor is up next, wired to GET /api/tenant."
    />
  );
}
