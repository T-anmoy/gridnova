"use client";

import { m, useReducedMotion } from "framer-motion";

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  x?: number;
  y?: number;
};

export default function ScrollReveal({ children, className, delay = 0, x = 0, y = 24 }: Props) {
  const reduced = useReducedMotion();
  // Always the same element on server and client: swapping to a plain <div>
  // for reduced-motion visitors caused a hydration mismatch that left the
  // server's `opacity: 0` in place, so those visitors saw empty sections.
  // Reduced motion now just makes the reveal instant.
  return (
    <m.div
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </m.div>
  );
}
