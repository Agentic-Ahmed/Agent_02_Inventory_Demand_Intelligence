"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Headline that reveals word-by-word with a masked rise + blur clear. */
export function KineticHeading({
  text,
  className,
  delay = 0.15,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  return (
    <h1 className={cn("flex flex-wrap", className)} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="mr-[0.25em] inline-block overflow-hidden pb-[0.08em] align-bottom"
        >
          <motion.span
            className="inline-block"
            initial={
              reduce ? false : { y: "115%", opacity: 0, filter: "blur(8px)" }
            }
            animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
            transition={{
              duration: 0.85,
              delay: delay + i * 0.085,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}
