"use client";

import { Check } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button-link";
import { clerkEnabled } from "@/lib/auth/clerk";
import { cn } from "@/lib/utils";

// With Clerk on, the CTAs go to real sign-up; in dev they enter the console
// (which gates first-timers into the onboarding tour).
const START_HREF = clerkEnabled ? "/sign-up" : "/app?intent=start";

type Plan = {
  name: string;
  desc: string;
  price: string;
  period?: string;
  note: string;
  cta: string;
  href: string;
  variant: "default" | "outline";
  highlight?: boolean;
  inherits: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    desc: "For a single store finding its footing.",
    price: "$0",
    period: "forever",
    note: "No card required.",
    cta: "Start free",
    href: START_HREF,
    variant: "outline",
    inherits: "Everything to get moving:",
    features: [
      "1 warehouse, up to 500 SKUs",
      "Demand forecasting + reorder agent",
      "7 / 30 / 90-day forecasts",
      "Approval inbox for every action",
      "Community support",
    ],
  },
  {
    name: "Growth",
    desc: "For growing teams running multiple locations.",
    price: "$499",
    period: "/mo",
    note: "Billed annually, or $599 month-to-month.",
    cta: "Start free trial",
    href: START_HREF,
    variant: "default",
    highlight: true,
    inherits: "Everything in Starter, plus:",
    features: [
      "Up to 10 warehouses, 25,000 SKUs",
      "All six agents, acting autonomously",
      "Spend, markdown & confidence guardrails",
      "AP2 signed supplier payments",
      "Slack + email buyer alerts",
      "Full audit trail",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    desc: "For large operations that need scale and control.",
    price: "Custom",
    note: "Volume pricing and SLAs.",
    cta: "Contact sales",
    href: "mailto:sales@quorum.app",
    variant: "outline",
    inherits: "Everything in Growth, plus:",
    features: [
      "Unlimited warehouses & SKUs",
      "Per-tenant isolation + row-level security",
      "SSO / SAML and custom roles",
      "Custom guardrail thresholds",
      "Dedicated success manager + SLA",
      "VPC or on-prem deployment",
    ],
  },
];

export function PricingV2() {
  return (
    <section id="pricing" className="relative scroll-mt-20 overflow-hidden border-t border-border">
      {/* teal brand field so the frosted plan cards read as glass */}
      <div aria-hidden className="landing-ambient pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
            Pricing that scales with your shelves.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade when the agents are running your reorders, not
            you.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.08} className="h-full">
              <div
                className={cn(
                  "glass relative flex h-full flex-col rounded-2xl border p-8 transition-transform duration-300 hover:-translate-y-1",
                  plan.highlight
                    ? "border-primary/40 bg-white/80 ring-1 ring-primary/40 dark:bg-white/[0.14] lg:scale-[1.02]"
                    : "border-black/[0.06] bg-white/70 dark:border-white/10 dark:bg-white/10",
                )}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                    Most popular
                  </span>
                ) : null}

                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.desc}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-foreground tabular">
                    {plan.price}
                  </span>
                  {plan.period ? (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.note}</p>

                <ButtonLink
                  href={plan.href}
                  variant={plan.variant}
                  size="lg"
                  className="mt-6 w-full"
                >
                  {plan.cta}
                </ButtonLink>

                <p className="mt-8 text-sm font-medium text-foreground">{plan.inherits}</p>
                <ul className="mt-4 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Every plan runs on signed payment mandates and per-tenant isolation.
          No card to start, cancel anytime.
        </p>
      </div>
    </section>
  );
}
