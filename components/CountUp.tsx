"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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

export default function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { prefix, num, suffix, isFloat, hasComma } = parse(value);

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
          // en-IN grouping (2,71,626) to match formatINR elsewhere on the
          // site — the default-locale toLocaleString() would render 3-digit
          // Western grouping (271,626) instead, visibly wrong mid-count and
          // on the final frame alike.
          const n = isFloat
            ? obj.val.toFixed(1)
            : hasComma
            ? Math.round(obj.val).toLocaleString("en-IN")
            : Math.round(obj.val).toString();
          ref.current.textContent = prefix + n + suffix;
        },
      });
    });
    return () => ctx.revert();
  }, [num, prefix, suffix, isFloat, hasComma]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
