"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/v2/magnetic";
import { cn } from "@/lib/utils";
import {
  STEPS,
  WelcomeStep,
  AgentsStep,
  ControlStep,
  ReadyStep,
} from "./steps";

const LAST = STEPS.length - 1;

/**
 * First-run product tour. Four steps, fully keyboard-navigable (← / → between
 * steps, Enter to advance, Esc to skip), with focus moved to each step heading so
 * screen readers announce the change. Honors prefers-reduced-motion. Sign-up is
 * handled before this (real Clerk auth); the final step just enters the console.
 */
export function Walkthrough({ onComplete }: { onComplete: () => void }) {
  const reduce = useReducedMotion();
  const [step, setStep] = React.useState(0);

  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // Move focus to each step heading so screen readers announce the new panel.
  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const meta = STEPS[step];

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function primary() {
    if (step < LAST) {
      setStep((s) => s + 1);
      return;
    }
    onComplete();
  }

  function onRootKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA";
    if (e.key === "Escape") {
      e.preventDefault();
      onComplete();
    } else if (e.key === "ArrowLeft" && !typing && step > 0) {
      e.preventDefault();
      back();
    } else if (e.key === "ArrowRight" && !typing && step < LAST) {
      e.preventDefault();
      primary();
    }
  }

  return (
    <div
      onKeyDown={onRootKeyDown}
      className="relative flex min-h-dvh flex-col bg-background text-foreground"
    >
      {/* subtle brand wash, kept off-content for legibility */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklch,var(--color-primary),transparent_92%),transparent_70%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-6 sm:px-6">
        <Brand />
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <Button variant="ghost" size="sm" onClick={onComplete} className="text-muted-foreground">
            Skip tour
          </Button>
        </div>
      </header>

      {/* segmented progress */}
      <div
        className="relative z-10 mx-auto mt-5 flex w-full max-w-2xl gap-1.5 px-5 sm:px-6"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
        aria-label={`Walkthrough progress: ${meta.label}`}
      >
        {STEPS.map((s, i) => (
          <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <motion.span
              className="block h-full rounded-full bg-primary"
              initial={false}
              animate={{ scaleX: i <= step ? 1 : 0 }}
              style={{ originX: 0 }}
              transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          primary();
        }}
        className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-6"
      >
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{meta.eyebrow}</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight outline-none sm:text-3xl"
          >
            {meta.title}
          </h1>

          <div className="mt-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={meta.id}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {step === 0 && <WelcomeStep />}
                {step === 1 && <AgentsStep />}
                {step === 2 && <ControlStep />}
                {step === 3 && <ReadyStep />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className={cn("mt-10 flex items-center gap-3", step === 0 ? "justify-end" : "justify-between")}>
          {step > 0 && (
            <Button type="button" variant="ghost" onClick={back} size="lg" className="h-11">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          )}
          <Magnetic strength={0.3}>
            <Button type="submit" size="lg" className="group h-11 px-6 text-base">
              {step < LAST ? (
                <>
                  Continue
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Enter Quorum
                </>
              )}
            </Button>
          </Magnetic>
        </div>
      </form>
    </div>
  );
}
