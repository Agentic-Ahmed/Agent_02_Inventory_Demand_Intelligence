"use client";

import { Wallet, BadgePercent, Gauge, Check, X } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GUARDS = [
  {
    icon: Wallet,
    color: "text-ok",
    bg: "bg-ok/10",
    title: "Spend caps",
    desc: "Purchase orders auto-approve under your limit. Above it, a buyer signs off before any money moves.",
  },
  {
    icon: BadgePercent,
    color: "text-tag",
    bg: "bg-tag/10",
    title: "Markdown depth",
    desc: "Discounts deeper than your cap escalate to a manager. No surprise fire-sales.",
  },
  {
    icon: Gauge,
    color: "text-horizon",
    bg: "bg-horizon/10",
    title: "Confidence floor",
    desc: "Low-confidence forecasts route to human review instead of triggering silent action.",
  },
];

export function ControlSection() {
  return (
    <section id="control" className="scroll-mt-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        <Reveal>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
              You stay in control of the money.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Agents do the work. Humans make the calls that spend. Every limit
              is yours to set, and every spend runs through a signed payment
              mandate.
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
                      <h3 className="text-sm font-semibold text-foreground">
                        {g.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {g.desc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>

        {/* Approval card */}
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Approval inbox
              </span>
              <Badge variant="secondary" className="font-normal">
                1 pending
              </Badge>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Purchase order, SKU-1000
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    1,200 units to West DC
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-foreground tabular">
                  $48,200
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge className="bg-broker/10 text-broker">needs: buyer</Badge>
                <span className="text-xs text-muted-foreground">
                  over the $10k auto-approve limit
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1">
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  <X className="size-3.5" />
                  Reject
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Check className="size-3.5 text-ok" />
              Approved by Dana Whitfield, 2m ago, logged to the audit trail
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
