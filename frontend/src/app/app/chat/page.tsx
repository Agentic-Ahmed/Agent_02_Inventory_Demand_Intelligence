import type { Metadata } from "next";

import { ChatScreen } from "@/components/console/chat/chat-screen";

export const metadata: Metadata = { title: "Ask Quorum" };

export default function ChatPage() {
  return <ChatScreen />;
}
