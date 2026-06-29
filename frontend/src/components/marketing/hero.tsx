"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { HeroPreview } from "@/components/marketing/hero-preview";

export function Hero() {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.09, delayChildren: 0.05 },
    },
  };
  const item = reduce
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 18 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
        },
      };

  return (
    <section className="relative overflow-hidden">
      {/* background: faint grid + brand glow, no AI-mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_85%_0%,var(--color-primary)/8%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_75%)] opacity-[0.4] dark:opacity-[0.25] bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px]"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-20 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8 lg:pt-24 lg:pb-24">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-xl"
        >
          <motion.p
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            Multi-agent inventory operations
          </motion.p>

          <motion.h1
            variants={item}
            className="mt-5 text-balance text-5xl font-semibold leading-[1.04] tracking-tight text-foreground lg:text-6xl"
          >
            Never run out. Never over-order.
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground"
          >
            Quorum forecasts demand, reorders stock, and rebalances warehouses
            on its own. You approve the calls that move real money.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <ButtonLink href="/app" size="lg" className="group">
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="#how" size="lg" variant="outline">
              See how it works
            </ButtonLink>
          </motion.div>
        </motion.div>

        <div className="lg:pl-4">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}
