"use client";

import * as React from "react";
import Link from "next/link";
import { Send, Square, MessagesSquare, ArrowRight, AlertTriangle } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { streamChat, IS_LIVE } from "@/lib/api/client";
import { AGENTS, type AgentKey } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_SKU = "SKU-1000";

const SUGGESTIONS = [
  "What should I reorder this week?",
  "Any stockout risks in the next 30 days?",
  "Which SKUs should we mark down?",
  "Summarize demand for SKU-1000.",
];

interface ToolActivity {
  tool: string;
  specialist?: string | null;
  status?: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ToolActivity[];
  escalations: string[];
  streaming: boolean;
  error?: string;
}

let idSeq = 0;
const nextId = () => `m${++idSeq}`;

export function ChatScreen() {
  const { tenantId, role, getToken } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = React.useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || streaming) return;

      const assistantId = nextId();
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "user", text: q, tools: [], escalations: [], streaming: false },
        { id: assistantId, role: "assistant", text: "", tools: [], escalations: [], streaming: true },
      ]);
      setInput("");
      setStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;

      const update = (fn: (msg: Message) => Message) =>
        setMessages((m) => m.map((msg) => (msg.id === assistantId ? fn(msg) : msg)));

      await streamChat(
        session,
        q,
        DEFAULT_SKU,
        (ev) => {
          switch (ev.type) {
            case "tool_call":
              update((msg) => ({ ...msg, tools: [...msg.tools, { tool: ev.tool }] }));
              break;
            case "tool_output":
              update((msg) => {
                const tools = [...msg.tools];
                for (let i = tools.length - 1; i >= 0; i--) {
                  if (!tools[i].specialist) {
                    tools[i] = { ...tools[i], specialist: ev.specialist, status: ev.status };
                    break;
                  }
                }
                return { ...msg, tools };
              });
              break;
            case "text":
              update((msg) => ({ ...msg, text: msg.text + ev.delta }));
              break;
            case "done":
              update((msg) => ({
                ...msg,
                text: ev.answer || msg.text,
                escalations: ev.escalations ?? [],
                streaming: false,
              }));
              break;
            case "error":
              update((msg) => ({ ...msg, error: ev.detail, streaming: false }));
              break;
          }
        },
        ac.signal,
      );

      // Stream ended (or aborted) — make sure nothing is left spinning.
      update((msg) => (msg.streaming ? { ...msg, streaming: false } : msg));
      setStreaming(false);
      abortRef.current = null;
    },
    [session, streaming],
  );

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-[32rem] w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Ask Quorum</h1>
        {!IS_LIVE ? (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn">Demo mode</span>
        ) : null}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <EmptyState onPick={send} />
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="glass flex items-end gap-2 rounded-2xl border border-border bg-white/60 p-2 dark:bg-white/10"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask about demand, reorders, stockouts…"
          aria-label="Message"
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        {streaming ? (
          <Button type="button" variant="outline" size="icon" onClick={stop} aria-label="Stop">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        )}
      </form>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        Quorum coordinates the six agents and routes any spend through approvals. Enter to send, Shift+Enter for a new line.
      </p>
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  const OrchIcon = AGENTS.orchestrator.icon;
  const waiting = message.streaming && !message.text && !message.error;

  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          AGENTS.orchestrator.bg,
          AGENTS.orchestrator.text,
        )}
      >
        <OrchIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {message.tools.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {message.tools.map((t, i) => (
              <ToolChip key={i} activity={t} />
            ))}
          </div>
        ) : null}

        {waiting ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex gap-1">
              <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
            </span>
            Consulting the team…
          </p>
        ) : null}

        {message.text ? (
          <div className="whitespace-pre-wrap text-sm text-foreground">
            {message.text}
            {message.streaming ? <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" /> : null}
          </div>
        ) : null}

        {message.escalations.length > 0 ? (
          <Link
            href="/app/approvals"
            className="inline-flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-foreground transition-colors hover:bg-warn/15"
          >
            <AlertTriangle className="size-4 shrink-0 text-warn" />
            Raised {message.escalations.length} approval{message.escalations.length > 1 ? "s" : ""} for review
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </Link>
        ) : null}

        {message.error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {message.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ToolChip({ activity }: { activity: ToolActivity }) {
  const agent = activity.specialist ? AGENTS[activity.specialist as AgentKey] : undefined;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs">
      <span className={cn("size-1.5 rounded-full", agent ? agent.text.replace("text-", "bg-") : "bg-muted-foreground")} />
      {agent ? <span className={cn("font-medium", agent.text)}>{agent.name}</span> : null}
      <span className="font-mono text-muted-foreground">{activity.tool}</span>
    </span>
  );
}

function Dot({ delay }: { delay?: string }) {
  return (
    <span
      className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MessagesSquare className="size-6" />
      </span>
      <div>
        <p className="text-base font-medium text-foreground">Ask Quorum about your inventory</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Natural-language questions to the orchestrator — it consults the specialists and explains the plan.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-border bg-card/50 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
