import * as React from "react";

import { cn } from "@/lib/utils";
import { dateTime } from "@/lib/format";
import type { AuditEvent } from "@/lib/api/types";
import { eventMeta, toneClasses, resolveActor, detailEntries } from "./audit-meta";

/** One event on the timeline. `last` omits the connector line below the dot. */
export function AuditEventRow({ event, last }: { event: AuditEvent; last?: boolean }) {
  const meta = eventMeta(event.event_type);
  const Icon = meta.icon;
  const actor = resolveActor(event.actor);
  const entries = detailEntries(event.detail);

  return (
    <li className="flex gap-3.5">
      {/* dot + connector */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            toneClasses(meta.tone),
          )}
        >
          <Icon className="size-4" />
        </span>
        {!last ? <span aria-hidden className="mt-1 w-px flex-1 bg-border/70" /> : null}
      </div>

      {/* content */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{meta.label}</span>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <span
            className={cn(
              "text-xs font-medium",
              actor.isAgent ? actor.textClass : "text-muted-foreground",
            )}
          >
            {actor.name}
          </span>
          <time
            dateTime={event.ts}
            className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground"
          >
            {dateTime(event.ts)}
          </time>
        </div>

        <p className="mt-0.5 text-sm text-muted-foreground">{event.summary}</p>

        {entries.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {entries.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[0.7rem]"
              >
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-foreground">{v}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}
