import type { Metadata } from "next";

import { IntegrationsSection } from "@/components/console/settings/integrations-section";

export const metadata: Metadata = { title: "Integrations · Settings" };

export default function SettingsIntegrationsPage() {
  return <IntegrationsSection />;
}
