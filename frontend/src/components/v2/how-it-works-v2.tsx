"use client";

import * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";
import { Database, Radar, Workflow, ShieldCheck } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { icon: Database, title: "Connect your data", desc: "Point Quorum at your sales history and live stock. No migration." },
  { icon: Radar, title: "Agents watch the signals", desc: "Forecasts, anomalies, and supplier risk, tracked continuously." },
  { icon: Workflow, title: "They act on their own", desc: "Reorders, transfers, and markdowns, inside your guardrails." },
  { icon: ShieldCheck, title: "You approve the big calls", desc: "Anything that spends real money waits for one human click." },
];

export function HowItWorksV2() {
  const root = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce || !root.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top 72%",
          end: "bottom 82%",
          scrub: 0.6,
        },
      });
      tl.to(".progress-line", { scaleX: 1, ease: "none" }, 0);
      gsap.utils.toArray<HTMLElement>(".howstep").forEach((el, i) => {
        tl.fromTo(
          el,
          { opacity: 0.25, y: 26 },
          { opacity: 1, y: 0, ease: "power2.out" },
          i * 0.25,
        );
        tl.fromTo(
          el.querySelector(".howicon"),
          { scale: 0.7, borderColor: "var(--color-border)" },
          { scale: 1, borderColor: "var(--color-primary)", ease: "back.out(2)" },
          i * 0.25,
        );
      });
    }, root);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <section id="how" className="relative scroll-mt-20 overflow-hidden">
      {/* teal brand field so the frosted step badges read as glass */}
      <div aria-hidden className="app-ambient pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
            From data to done, automatically.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Quorum runs the full inventory loop and only stops to ask when a
            decision crosses a line you set.
          </p>
        </div>

        <div ref={root} className="relative mt-20">
          <div className="pointer-events-none absolute top-8 right-[12.5%] left-[12.5%] hidden lg:block">
            <div className="h-px w-full bg-border" />
            <div className="progress-line absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary" />
          </div>

          <ol className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="howstep relative text-center lg:text-left">
                  <span className="howicon glass relative z-10 mx-auto flex size-16 items-center justify-center rounded-2xl border-2 border-white/20 bg-white/60 text-primary shadow-lg shadow-black/5 dark:border-white/10 dark:bg-white/10 lg:mx-0">
                    <Icon className="size-7" />
                  </span>
                  <h3 className="mt-6 text-lg font-semibold text-foreground">
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
