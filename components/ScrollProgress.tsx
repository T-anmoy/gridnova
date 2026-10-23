"use client";

import { useEffect, useRef } from "react";

// The 2px reading-progress bar. It used to set React state on every scroll
// event and animate `width`, which meant a re-render plus a layout and paint
// per scroll frame on every page. Now it is a compositor-only `scaleX`:
// - where CSS scroll-driven animations exist (Chrome/Edge/Android Chrome,
//   Safari 26+) the browser drives it from `.scroll-progress` in globals.css
//   with no JavaScript at all;
// - elsewhere a passive listener writes the transform once per animation
//   frame through a ref (still no React state).
// Hidden under prefers-reduced-motion (globals.css).
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: scroll()")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      el.style.transform = `scaleX(${total > 0 ? Math.min(1, doc.scrollTop / total) : 0})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" data-testid="scroll-progress" className="scroll-progress" />;
}
