import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { ComingSoon } from "@/components/console/coming-soon";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditPage() {
  return (
    <ComingSoon
      icon={ScrollText}
      title="Action log & audit trail"
      description="Every autonomous decision and human approval, timestamped and reasoned."
      note="The filterable audit timeline is up next, wired to GET /api/audit."
    />
  );
}
