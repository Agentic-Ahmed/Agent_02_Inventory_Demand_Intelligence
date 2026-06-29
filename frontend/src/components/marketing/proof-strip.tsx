"use client";

import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";

const STATS = [
  { lead: "up to", to: 50, suffix: "%", label: "lower forecast error", foot: "20-50% in pilots" },
  { lead: "up to", to: 65, suffix: "%", label: "fewer stockouts", foot: "vs. manual reordering" },
  { lead: "up to", to: 15, suffix: "%", label: "lower carrying costs", foot: "10-15% range" },
  { lead: "under", to: 4, suffix: " hrs", label: "reorder cycle", foot: "from 3 to 7 days" },
];

export function ProofStrip() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {s.lead}
                </span>
                <span className="mt-1 font-mono text-4xl font-semibold tracking-tight text-foreground tabular lg:text-5xl">
                  <CountUp to={s.to} suffix={s.suffix} duration={1.8} />
                </span>
                <span className="mt-2 text-sm font-medium text-foreground">
                  {s.label}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {s.foot}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
