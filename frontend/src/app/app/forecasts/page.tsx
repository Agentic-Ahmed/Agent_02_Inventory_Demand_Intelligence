import type { Metadata } from "next";

import { ForecastsScreen } from "@/components/console/forecasts/forecasts-screen";

export const metadata: Metadata = { title: "Forecasts" };

export default function ForecastsPage() {
  return <ForecastsScreen />;
}
