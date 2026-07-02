import type { Metadata } from "next";

import { BillingSection } from "@/components/console/settings/billing-section";

export const metadata: Metadata = { title: "Billing · Settings" };

export default function SettingsBillingPage() {
  return <BillingSection />;
}
