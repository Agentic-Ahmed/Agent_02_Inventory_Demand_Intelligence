"use client";

import * as React from "react";
import { motion, useMotionValue, useMotionTemplate } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A card with a cursor-following radial glow in a given accent color, plus a
 * brightening border on hover. Pure motion values, no re-render on move.
 */
export function SpotlightCard({
  children,
  className,
  glow = "var(--color-primary)",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  }

  const spotlight = useMotionTemplate`radial-gradient(240px circle at ${mx}px ${my}px, color-mix(in oklch, ${glow}, transparent 80%), transparent 72%)`;
  const ring = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, color-mix(in oklch, ${glow}, transparent 55%), transparent 70%)`;

  return (
    <div
      onMouseMove={handleMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-transparent transition-transform duration-300 hover:-translate-y-1 dark:border-white/10",
        className,
      )}
    >
      {/* border glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: ring }}
      />
      {/* inner fill = the frosted-glass surface (so only the border shows the ring) */}
      <div className="glass absolute inset-px rounded-[calc(1rem-1px)] bg-white/75 dark:bg-white/10" />
      {/* surface spotlight */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
