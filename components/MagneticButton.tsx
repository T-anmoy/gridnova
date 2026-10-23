"use client";

import { useRef } from "react";
import { prefersReducedMotion } from "@/lib/reveal";

// The CTA leans toward a mouse pointer and springs back when it leaves. Touch
// screens never fire these mouse events, so phones pay nothing. The transform
// is written straight to the element (no React state, no animation library);
// the springy settle is the CSS transition's slight overshoot.
export default function MagneticButton({
  children,
  className,
  strength = 0.35,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{
        display: "inline-block",
        transition: "transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1)",
      }}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el || prefersReducedMotion()) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * strength;
        const y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.transform = "";
      }}
      className={className}
    >
      {children}
    </div>
  );
}
