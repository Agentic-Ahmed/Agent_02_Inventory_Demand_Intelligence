"use client";

import * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";
import { Database, Radar, Workflow, ShieldCheck } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    icon: Database,
    title: "Connect your data",
    desc: "Point Quorum at your sales history and live stock. No migration, no rip-and-replace.",
  },
  {
    icon: Radar,
    title: "Agents watch the signals",
    desc: "Forecasts, anomalies, and supplier risk are tracked continuously, per SKU, per warehouse.",
  },
  {
    icon: Workflow,
    title: "They act on their own",
    desc: "Reorders drafted, stock rebalanced, markdowns planned, all inside your guardrails.",
  },
  {
    icon: ShieldCheck,
    title: "You approve the big calls",
    desc: "Anything that spends real money waits for a human. One click to approve or reject.",
  },
];

export function HowItWorks() {
  const root = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".step-node", {
        opacity: 0,
        y: 26,
        duration: 0.6,
        stagger: 0.14,
        ease: "power2.out",
        scrollTrigger: { trigger: root.current, start: "top 72%" },
      });
      gsap.fromTo(
        ".progress-line",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          transformOrigin: "left center",
          scrollTrigger: {
            trigger: root.current,
            start: "top 66%",
            end: "bottom 75%",
            scrub: true,
          },
        },
      );
    }, root);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <section id="how" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
            From data to done, automatically.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Quorum runs the full inventory loop on its own and only stops to ask
            when a decision crosses a line you set.
          </p>
        </div>

        <div ref={root} className="relative mt-16">
          {/* connector line (desktop) */}
          <div className="pointer-events-none absolute top-7 right-[12.5%] left-[12.5%] hidden lg:block">
            <div className="h-px w-full bg-border" />
            <div className="progress-line absolute inset-x-0 top-0 h-px origin-left bg-primary" />
          </div>

          <ol className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="step-node relative">
                  <span className="relative z-10 flex size-14 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
