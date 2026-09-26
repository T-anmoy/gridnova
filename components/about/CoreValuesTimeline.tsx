"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Messages } from "@/lib/i18n/types";

export default function CoreValuesTimeline({ t }: { t: Messages["about"]["values"] }) {
  const VALUES = t.items.map((v, i) => ({ ...v, n: String(i + 1).padStart(2, "0") }));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      // Vertical line grows as page scrolls through section
      gsap.fromTo(
        ".value-line",
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: "top",
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 65%",
            end: "bottom 80%",
            scrub: 0.5,
          },
        }
      );

      // Odd rows (01, 03, 05) from left; even rows (02, 04) from right
      gsap.utils.toArray<HTMLElement>(".value-row").forEach((row, i) => {
        const fromLeft = i % 2 === 0;
        const badge = row.querySelector<HTMLElement>(".value-badge");

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: row,
            start: "top 82%",
            toggleActions: "play reverse play reverse",
          },
        });

        // Row slides in from its origin side
        tl.fromTo(
          row,
          { opacity: 0, x: fromLeft ? -80 : 80 },
          { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" },
          0
        );

        // Number badge pops in slightly after row starts
        if (badge) {
          tl.fromTo(
            badge,
            { scale: 0.5 },
            { scale: 1, duration: 0.45, ease: "back.out(1.7)" },
            0.12
          );
        }
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative bg-white py-24 md:py-28 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
        <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[20ch] text-balance">
          {t.title}
        </h2>

        <div className="relative mt-16 max-w-[760px]">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[#e4e8ee]">
            <div className="value-line absolute inset-0 bg-gradient-to-b from-[#f7a800] to-[#f7a800]/30" />
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
