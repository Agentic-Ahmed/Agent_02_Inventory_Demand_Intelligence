"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Scroll-reveal primitive. Fades + lifts content as it enters the viewport,
 * once. Honors prefers-reduced-motion by rendering static. Used across the
 * marketing page so reveal motion is consistent and motivated (hierarchy:
 * content arrives as you reach it).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 22,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.25 }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
