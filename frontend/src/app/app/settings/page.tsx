import type { Metadata } from "next";

import { GeneralSection } from "@/components/console/settings/general-section";

export const metadata: Metadata = { title: "General · Settings" };

export default function SettingsGeneralPage() {
  return <GeneralSection />;
}
