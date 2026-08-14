"use client";

import { useEffect, useState } from "react";

export default function ScrollProgress() {
  const [pct, setPct] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setShow(true), 0);
    const onScroll = () => {
      const doc = document.documentElement;
      const scrolled = doc.scrollTop;
      const total = doc.scrollHeight - doc.clientHeight;
      setPct(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 z-[999] h-[2px] bg-[#f7a800] pointer-events-none origin-left"
      style={{ width: `${pct}%`, transition: "width 0.04s linear" }}
    />
  );
}
