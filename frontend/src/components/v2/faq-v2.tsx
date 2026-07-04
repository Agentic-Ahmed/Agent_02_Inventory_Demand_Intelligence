"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "How do the agents avoid spending on the wrong thing?",
    a: "Every money action passes two checks: a guardrail that decides whether to spend, and a hard limit inside the tool that makes over-spending physically impossible. Purchase orders auto-approve under the cap you set; anything above it waits for a human click. Authorized payments then execute through Google AP2 signed mandates — never outside them.",
  },
  {
    q: "Is my company's data isolated from other tenants?",
    a: "Yes, completely. Every session, database row, and vector query is keyed by your tenant ID, backed by Postgres row-level security and per-tenant filters. No forecast, order, or signal ever crosses between businesses — one leak between clients would be fatal, so everything is isolated by design.",
  },
  {
    q: "What kind of results can I expect?",
    a: "Teams typically see 20–50% lower forecast error, up to 65% fewer stockouts, and 10–15% lower carrying costs. The reorder cycle drops from the usual 3–7 days to under 4 hours, because the agents watch signals continuously instead of waiting for a weekly review.",
  },
  {
    q: "Do I need to replace my WMS or ERP?",
    a: "No. Quorum connects to the systems you already run — your WMS for stock, your ERP for purchase orders, and your commerce platform for pricing. There's no migration: you point it at your sales history and live inventory, and it starts working.",
  },
  {
    q: "What happens when a forecast isn't confident?",
    a: "Low-confidence forecasts route to human review instead of triggering silent action. You set the confidence floor (70% by default), and anything below it lands in your approval inbox with the reasoning attached, so a person makes the call.",
  },
  {
    q: "How are supplier payments actually executed?",
    a: "Through Google AP2 (the Agent Payments Protocol), using a signed spend mandate. Guardrails decide whether to spend, a hard ceiling is the physical backstop that never auto-executes above it, and AP2 settles how the authorized payment runs. Funds are never disbursed any other way.",
  },
];

export function FaqV2() {
  const [open, setOpen] = React.useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="faq" className="relative scroll-mt-20 overflow-hidden border-t border-border">
      {/* teal brand field so the frosted question cards read as glass */}
      <div aria-hidden className="landing-ambient pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
            Questions, answered.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything teams ask before putting their inventory on autopilot.
          </p>
        </div>

        <div className="mt-14 space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            const panelId = `faq-panel-${i}`;
            const btnId = `faq-btn-${i}`;
            return (
              <Reveal key={item.q} delay={i * 0.05}>
                <div
                  className={cn(
                    "glass overflow-hidden rounded-2xl border bg-white/70 transition-colors dark:bg-white/10",
                    isOpen
                      ? "border-primary/40"
                      : "border-black/[0.06] dark:border-white/10",
                  )}
                >
                  <h3>
                    <button
                      id={btnId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <span className="text-base font-medium text-foreground">{item.q}</span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-5 shrink-0 text-muted-foreground transition-transform duration-300",
                          isOpen && "rotate-180 text-primary",
                        )}
                      />
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        key="content"
                        id={panelId}
                        role="region"
                        aria-labelledby={btnId}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                          {item.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
