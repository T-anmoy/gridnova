"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

function parse(raw: string) {
  const m = raw.match(/^([\d,\.]+)(.*)/);
  const numStr = m?.[1]?.replace(/,/g, "") ?? "0";
  return {
    num: parseFloat(numStr),
    suffix: m?.[2] ?? "",
    isFloat: numStr.includes("."),
    hasComma: !!m?.[1]?.includes(","),
  };
}

export default function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { num, suffix, isFloat, hasComma } = parse(value);

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);

    const obj = { val: 0 };
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        val: num,
        duration: 2,
        ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
        onUpdate() {
          if (!ref.current) return;
          const n = isFloat
            ? obj.val.toFixed(1)
            : hasComma
            ? Math.round(obj.val).toLocaleString()
            : Math.round(obj.val).toString();
          ref.current.textContent = n + suffix;
        },
      });
    });
    return () => ctx.revert();
  }, [num, suffix, isFloat, hasComma]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
