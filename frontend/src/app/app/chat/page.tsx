import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

import { ComingSoon } from "@/components/console/coming-soon";

export const metadata: Metadata = { title: "Ask Quorum" };

export default function ChatPage() {
  return (
    <ComingSoon
      icon={MessageSquare}
      title="Ask Quorum"
      description="Natural-language questions to the orchestrator, with live agent activity."
      note="The streaming chat panel is up next, wired to POST /api/chat/stream."
    />
  );
}
