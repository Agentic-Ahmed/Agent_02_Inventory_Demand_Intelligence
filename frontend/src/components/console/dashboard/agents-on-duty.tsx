import * as React from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ALL_AGENTS } from "@/lib/agents";
import { cn } from "@/lib/utils";

/**
 * The six agents and their live status. Folds in the "agents on duty" panel from
 * the onboarding hand-off so the dashboard confirms the team is running.
 */
export function AgentsOnDuty() {
  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle>Agents on duty</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul role="list" className="divide-y divide-border/60">
          {ALL_AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <li key={agent.key} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    agent.bg,
                    agent.text,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{agent.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{agent.tagline}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ok">
                  <span className="size-1.5 rounded-full bg-ok" />
                  On duty
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
