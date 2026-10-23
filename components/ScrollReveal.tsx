"use client";

import { useEffect, useRef } from "react";
import { observeReveal } from "@/lib/reveal";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Seconds, as before. */
  delay?: number;
  /** Starting offset in px. */
  x?: number;
  y?: number;
};

// Fade-and-slide in on first scroll into view. Plain CSS transitions on one
// shared IntersectionObserver (lib/reveal.ts) — no animation library, no
// per-instance motion values. The server renders it visible; it is hidden
// only after hydration and only when it starts below the fold, so it never
// delays the first paint or the LCP. Reduced motion: never hidden.
export default function ScrollReveal({ children, className, delay = 0, x = 0, y = 24 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    return el ? observeReveal(el) : undefined;
  }, []);

  const style = {
    "--reveal-x": `${x}px`,
    "--reveal-y": `${y}px`,
    ...(delay ? { "--reveal-delay": `${delay}s` } : {}),
  } as React.CSSProperties;

  return (
    <div ref={ref} data-reveal="" className={className} style={style}>
      {children}
    </div>
  );
}
