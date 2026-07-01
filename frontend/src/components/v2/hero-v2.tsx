"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Magnetic } from "@/components/v2/magnetic";
import { KineticHeading } from "@/components/v2/kinetic-heading";
import { clerkEnabled } from "@/lib/auth/clerk";

const AgentConstellation = dynamic(
  () => import("@/components/v2/agent-constellation"),
  { ssr: false },
);

// With Clerk on, "Start free" goes to real sign-up; in dev it enters the
// console, which gates first-timers into the product tour.
const START_HREF = clerkEnabled ? "/sign-up" : "/app?intent=start";

export function HeroV2() {
  const reduce = useReducedMotion();
  const sectionRef = React.useRef<HTMLElement>(null);
  const [inView, setInView] = React.useState(true);

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // `dark` is scoped to this section so the hero always renders on a dark
    // canvas (where the glowing constellation reads well), even in light mode.
    <section
      ref={sectionRef}
      className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground"
    >
      {/* WebGL constellation (drag to orbit) */}
      <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing">
        <AgentConstellation animate={!reduce} paused={!inView} />
      </div>

      {/* legibility scrims (no AI-mesh, just depth + readability) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(125%_95%_at_50%_42%,transparent_52%,color-mix(in_oklch,var(--color-background),transparent_8%)_100%)]"
      />
      {/* soft dark disc directly behind the headline for legibility */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(30%_28%_at_50%_46%,color-mix(in_oklch,var(--color-background),transparent_25%),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 bg-gradient-to-t from-background to-transparent"
      />

      {/* content */}
      <div className="pointer-events-none relative z-20 mx-auto flex min-h-[100dvh] max-w-5xl flex-col items-center justify-center px-4 pt-20 pb-16 text-center sm:px-6">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          A quorum of six agents, running your inventory
        </motion.p>

        <KineticHeading
          text="Never run out. Never over-order."
          className="mt-7 justify-center text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
        />

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl"
        >
          Quorum forecasts demand, reorders stock, and rebalances warehouses on
          its own. You approve the calls that move real money.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          className="pointer-events-auto mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Magnetic strength={0.45}>
            <ButtonLink href={START_HREF} size="lg" className="group h-12 px-6 text-base">
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </Magnetic>
          <Magnetic strength={0.35}>
            <ButtonLink
              href="#how"
              size="lg"
              variant="outline"
              className="h-12 bg-card/40 px-6 text-base backdrop-blur-sm"
            >
              See how it works
            </ButtonLink>
          </Magnetic>
        </motion.div>
      </div>
    </section>
  );
}
