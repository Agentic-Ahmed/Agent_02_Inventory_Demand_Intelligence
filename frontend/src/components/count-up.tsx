"use client";

import * as React from "react";
import { useInView, useReducedMotion, animate } from "motion/react";

/**
 * Counts a number up when it scrolls into view. Respects reduced motion
 * (renders the final value immediately). Used for outcome stats and KPIs.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.4,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState(reduce ? to : from);

  React.useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, reduce, from, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
