"use client";

import { useEffect } from "react";
import { setLenis } from "@/lib/lenis";

// Smooth scrolling is a desktop nicety: it is only started for a precise
// pointer (mouse / trackpad) and never under reduced motion. Phones and
// tablets keep native momentum scrolling and never download Lenis. It is
// loaded dynamically, and driven by a plain requestAnimationFrame loop, so no
// animation runtime is pulled into every page's initial bundle. ScrollTrigger
// (used by a few pages) listens to the native scroll events Lenis produces.
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const wantsSmooth =
      window.matchMedia("(pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!wantsSmooth) return;

    let cancelled = false;
    let frame = 0;
    let destroy: (() => void) | undefined;

    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 1.1,
      });
      setLenis(lenis);
      const loop = (time: number) => {
        lenis.raf(time);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
      destroy = () => {
        lenis.destroy();
        setLenis(null);
      };
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      destroy?.();
    };
  }, []);

  return <>{children}</>;
}
