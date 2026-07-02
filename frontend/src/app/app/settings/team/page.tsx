import type { Metadata } from "next";

import { TeamSection } from "@/components/console/settings/team-section";

export const metadata: Metadata = { title: "Team · Settings" };

export default function SettingsTeamPage() {
  return <TeamSection />;
}
