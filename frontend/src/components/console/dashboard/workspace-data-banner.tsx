"use client";

import * as React from "react";
import { Database, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/api/session";
import { hasFixture } from "@/lib/api/fixtures";
import { isSampleData, setSampleData } from "@/lib/api/sample-data";

/**
 * Shown only for a real (provisioned) workspace, never the dev demo tenants:
 *   empty  -> invite the user to load sample data and see a populated console
 *   sample -> remind them it's demo data and offer to clear it
 * Toggling reloads so every screen re-reads the fixture source.
 */
export function WorkspaceDataBanner() {
  const { tenantId } = useSession();
  // null until mounted, so we don't flash the wrong state or mismatch hydration.
  const [sample, setSample] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setSample(isSampleData(tenantId));
  }, [tenantId]);

  if (hasFixture(tenantId) || sample === null) return null;

  const load = () => {
    setSampleData(tenantId, true);
    window.location.reload();
  };
  const clear = () => {
    setSampleData(tenantId, false);
    window.location.reload();
  };

  if (sample) {
    return (
      <div
        role="status"
        className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3"
      >
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-foreground">
          You&rsquo;re exploring <span className="font-medium">sample data</span> — it isn&rsquo;t real.
          Clear it whenever you want to start fresh.
        </p>
        <Button variant="outline" size="sm" onClick={clear}>
          Clear sample data
        </Button>
      </div>
    );
  }

  return (
    <div className="glass mb-6 flex flex-col gap-4 rounded-xl border border-dashed border-border bg-white/60 px-5 py-6 dark:bg-white/10 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Database className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Your workspace is empty</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          As your agents run — and your systems connect — forecasts, approvals, and inventory
          will land here. Want to see how a live console looks first?
        </p>
      </div>
      <Button size="sm" onClick={load} className="shrink-0">
        <Sparkles className="size-4" />
        Load sample data
      </Button>
    </div>
  );
}
