import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { PageContainer, PageHeader } from "./page-shell";

/** Placeholder for console screens still being built — keeps navigation whole
 *  with a proper, on-brand empty state rather than a 404. */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  note,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  note: string;
}) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <p className="text-sm font-medium text-foreground">In progress</p>
        <p className="max-w-md text-sm text-muted-foreground">{note}</p>
      </div>
    </PageContainer>
  );
}
