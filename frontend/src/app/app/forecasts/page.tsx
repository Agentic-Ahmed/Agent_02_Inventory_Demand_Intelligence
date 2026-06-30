import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";

import { ComingSoon } from "@/components/console/coming-soon";

export const metadata: Metadata = { title: "Forecasts" };

export default function ForecastsPage() {
  return (
    <ComingSoon
      icon={TrendingUp}
      title="Forecast & SKU explorer"
      description="Per-SKU demand forecasts over 7, 30, and 90 days, with confidence."
      note="The SKU explorer with horizon charts is up next."
    />
  );
}
