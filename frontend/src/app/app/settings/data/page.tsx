import type { Metadata } from "next";

import { DataControlsSection } from "@/components/console/settings/data-controls-section";

export const metadata: Metadata = { title: "Data controls · Settings" };

export default function SettingsDataPage() {
  return <DataControlsSection />;
}
