import type { Metadata } from "next";
import { Inbox } from "lucide-react";

import { ComingSoon } from "@/components/console/coming-soon";

export const metadata: Metadata = { title: "Approvals" };

export default function ApprovalsPage() {
  return (
    <ComingSoon
      icon={Inbox}
      title="Approval inbox"
      description="Money and price actions that tripped a guardrail, waiting on a human."
      note="The Approve / Reject / Modify queue is up next — role-gated and fully audited."
    />
  );
}
