import type { Metadata } from "next";

import { GuardrailsSection } from "@/components/console/settings/guardrails-section";

export const metadata: Metadata = { title: "Guardrails · Settings" };

export default function SettingsGuardrailsPage() {
  return <GuardrailsSection />;
}
