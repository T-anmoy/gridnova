"use client";

import { useEffect, useRef } from "react";
import { observeReveal } from "@/lib/reveal";
import type { Messages } from "@/lib/i18n/types";

export default function CoreValuesTimeline({ t }: { t: Messages["about"]["values"] }) {
  const VALUES = t.items.map((v, i) => ({ ...v, n: String(i + 1).padStart(2, "0") }));
  const ref = useRef<HTMLDivElement>(null);

  // Each row slides in from its own side (odd rows from the left, even from
  // the right) as it arrives, and its number badge pops a beat later
  // (globals.css: .value-row). The rail fill follows the scroll position
  // (.scrub-fill). CSS only, on the shared reveal observer; everything is
  // visible without JavaScript or under reduced motion.
  useEffect(() => {
    const rows = Array.from(ref.current?.querySelectorAll<HTMLElement>(".value-row") ?? []);
    const cleanups = rows.map((row, i) => {
      row.style.setProperty("--reveal-x", i % 2 === 0 ? "-80px" : "80px");
      row.style.setProperty("--reveal-y", "0px");
      return observeReveal(row);
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <section ref={ref} className="relative bg-white py-24 md:py-28 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
        <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[20ch] text-balance">
          {t.title}
        </h2>

        <div className="scrub-track relative mt-16 max-w-[760px]">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[#e4e8ee]">
            <div className="value-line scrub-fill absolute inset-0 bg-gradient-to-b from-[#f7a800] to-[#f7a800]/30" />
          </div>
          <div className="space-y-10">
            {VALUES.map((v) => (
              <div key={v.n} className="value-row relative pl-14">
                <span className="value-badge absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#0e2a63] font-utility text-xs font-semibold text-[#0e2a63]">
                  {v.n}
                </span>
                <h3 className="font-display text-[#0e2a63] text-xl font-semibold">
                  {v.title}
                </h3>
                <p className="mt-1.5 text-[#111827]/60 leading-relaxed max-w-[54ch]">
                  {v.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
