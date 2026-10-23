"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/reveal";

// Optional leading non-digit run (e.g. "₹") is preserved as a prefix so this
// still works for currency-formatted values like "₹2,71,626", not just the
// trailing-suffix values ("4,800+") this was originally written for.
function parse(raw: string) {
  const m = raw.match(/^(\D*)([\d,\.]+)(.*)/);
  const numStr = m?.[2]?.replace(/,/g, "") ?? "0";
  return {
    prefix: m?.[1] ?? "",
    num: parseFloat(numStr),
    suffix: m?.[3] ?? "",
    isFloat: numStr.includes("."),
    hasComma: !!m?.[2]?.includes(","),
  };
}

const DURATION_MS = 2000;
// power2.out, as before.
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

// The real figure is server-rendered, so it is correct without JavaScript and
// under reduced motion. Otherwise it counts up from 0 once, when it first
// comes within 85% of the viewport height (the old ScrollTrigger "top 85%"),
// with one requestAnimationFrame loop writing the text directly — no
// animation library and no React re-renders.
export default function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { prefix, num, suffix, isFloat, hasComma } = parse(value);

  useEffect(() => {
    const el = ref.current;
    // Write into React's own text node, so a later change of `value` still
    // lands in the visible node.
    const text = el?.firstChild;
    if (!el || !(text instanceof Text) || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;

    // en-IN grouping (2,71,626) to match formatINR elsewhere on the site — the
    // default-locale toLocaleString() would render 3-digit Western grouping
    // (271,626) instead, visibly wrong mid-count and on the final frame alike.
    const format = (v: number) =>
      prefix +
      (isFloat ? v.toFixed(1) : hasComma ? Math.round(v).toLocaleString("en-IN") : Math.round(v).toString()) +
      suffix;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          text.nodeValue = format(num * easeOut(t));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, num, prefix, suffix, isFloat, hasComma]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
