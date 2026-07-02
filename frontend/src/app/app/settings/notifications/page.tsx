import type { Metadata } from "next";

import { NotificationsSection } from "@/components/console/settings/notifications-section";

export const metadata: Metadata = { title: "Notifications · Settings" };

export default function SettingsNotificationsPage() {
  return <NotificationsSection />;
}
