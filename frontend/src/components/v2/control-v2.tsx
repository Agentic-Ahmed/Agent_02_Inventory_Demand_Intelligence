"use client";

import { Wallet, BadgePercent, Gauge } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { LiveConsole } from "@/components/v2/live-console";
import { cn } from "@/lib/utils";

const GUARDS = [
  { icon: Wallet, color: "text-ok", bg: "bg-ok/10", title: "Spend caps", desc: "POs auto-approve under your limit. Above it, a buyer signs off before money moves." },
  { icon: BadgePercent, color: "text-tag", bg: "bg-tag/10", title: "Markdown depth", desc: "Discounts deeper than your cap escalate to a manager. No surprise fire-sales." },
  { icon: Gauge, color: "text-horizon", bg: "bg-horizon/10", title: "Confidence floor", desc: "Low-confidence forecasts route to human review, never silent action." },
];

export function ControlV2() {
  return (
    <section id="control" className="scroll-mt-20 border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                You stay in control of the money.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Agents do the work. Humans make the calls that spend. Every limit
                is yours, and every payment runs through a signed mandate.
              </p>
              <ul className="mt-8 space-y-5">
                {GUARDS.map((g) => {
                  const Icon = g.icon;
                  return (
                    <li key={g.title} className="flex gap-4">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", g.bg)}>
                        <Icon className={cn("size-[1.1rem]", g.color)} />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <LiveConsole />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
