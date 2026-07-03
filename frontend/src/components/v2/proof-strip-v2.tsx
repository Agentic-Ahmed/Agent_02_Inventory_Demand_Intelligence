"use client";

import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";

const STATS = [
  { lead: "up to", to: 50, suffix: "%", label: "lower forecast error", accent: "var(--color-horizon)" },
  { lead: "up to", to: 65, suffix: "%", label: "fewer stockouts", accent: "var(--color-broker)" },
  { lead: "up to", to: 15, suffix: "%", label: "lower carrying costs", accent: "var(--color-router)" },
  { lead: "under", to: 4, suffix: " hrs", label: "reorder cycle", accent: "var(--color-primary)" },
];

export function ProofStripV2() {
  return (
    <section className="relative bg-background">
      {/* transition out of the dark hero — eased fade so the seam blends subtly */}
      <div
        aria-hidden
        className="hero-fade pointer-events-none absolute inset-x-0 -top-px h-44"
      />

      <div className="mx-auto max-w-7xl px-4 pt-40 pb-16 sm:px-6 lg:px-8 lg:pt-44 lg:pb-20">
        <Reveal>
          <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Outcomes our customers see
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1}>
              <div className="group flex flex-col items-center text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {s.lead}
                </span>
                <span className="mt-1 font-mono text-5xl font-semibold tracking-tight text-foreground tabular lg:text-6xl">
                  <CountUp to={s.to} suffix={s.suffix} duration={1.9} />
                </span>
                <span
                  className="mt-3 h-0.5 w-10 rounded-full transition-all duration-300 group-hover:w-16"
                  style={{ background: s.accent }}
                />
                <span className="mt-3 max-w-[12rem] text-sm font-medium text-foreground">
                  {s.label}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
