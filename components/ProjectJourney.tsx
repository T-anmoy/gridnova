"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "@/components/i18n/Link";
import { fmt, type Messages } from "@/lib/i18n/types";

// "How your rooftop project works" — the eight real steps, in plain words.
// Same scroll-scrubbed progress line as the About page's values timeline:
// vertical on phones/tablets, horizontal across each row on desktop.
export default function ProjectJourney({ t }: { t: Messages["home"]["journey"] }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".journey-fill",
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: "top",
          ease: "none",
          scrollTrigger: { trigger: ".journey-list", start: "top 70%", end: "bottom 70%", scrub: 0.5 },
        },
      );
      gsap.fromTo(
        ".journey-step",
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.07,
          scrollTrigger: { trigger: ".journey-list", start: "top 78%" },
        },
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative bg-white py-24 md:py-32 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16 items-end mb-12 md:mb-16">
          <div>
            <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
            <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,7vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium text-balance">
              {t.title}
            </h2>
          </div>
          <p className="text-[#111827]/60 leading-relaxed max-w-[52ch]">{t.intro}</p>
        </div>

        <div className="relative">
          {/* Progress rail: left edge on small screens */}
          <div className="lg:hidden absolute left-[19px] top-2 bottom-2 w-px bg-[#e4e8ee]" aria-hidden="true">
            <div className="journey-fill absolute inset-0 bg-gradient-to-b from-[#f7a800] to-[#f7a800]/30" />
          </div>
          <ol className="journey-list relative grid lg:grid-cols-4 gap-x-6 gap-y-8 lg:gap-y-12">
            {t.steps.map((step, i) => (
              <li key={step.id} className="journey-step relative pl-14 lg:pl-0">
                <span className="absolute left-0 top-0 lg:static flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#0e2a63] font-utility text-xs font-semibold text-[#0e2a63]">
                  {i + 1}
                </span>
                <span className="hidden lg:block mt-4 h-px w-full bg-gradient-to-r from-[#f7a800] to-[#e4e8ee]" aria-hidden="true" />
                <p className="sr-only">{fmt(t.stepLabel, { n: i + 1 })}</p>
                <h3 className="lg:mt-4 font-display text-[#0e2a63] text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[#111827]/60 text-sm leading-relaxed max-w-[40ch]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 rounded-2xl bg-[#f7f9fc] border border-[#e4e8ee] p-5 md:p-6">
          <p className="text-[#111827]/60 text-sm leading-relaxed max-w-[70ch]">{t.note}</p>
          <Link href="/contact" className="btn btn-primary w-fit">
            {t.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
