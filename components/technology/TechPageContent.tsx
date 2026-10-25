"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import techPhoto from "@/public/images/TECHNOLOGY ENGINEERING.webp";
import type { Messages } from "@/lib/i18n/types";

// Per-step colours only; titles, bodies and nav labels come from messages
// (technology.steps, same order).
const STEP_STYLES = [
  {
    n: "01",
    bg: "bg-[#f7f9fc]",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#2f5daa]",
  },
  {
    n: "02",
    bg: "bg-white",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#2f5daa]",
  },
  {
    n: "03",
    bg: "bg-[#091c3c]",
    textColor: "text-white",
    bodyColor: "text-white/60",
    borderColor: "border-white/10",
    accentColor: "text-[#f7a800]",
  },
  {
    n: "04",
    bg: "bg-[#0e2a63]",
    textColor: "text-white",
    bodyColor: "text-white/60",
    borderColor: "border-white/10",
    accentColor: "text-[#f7a800]",
  },
  {
    n: "05",
    bg: "bg-[#f7f9fc]",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#f7a800]",
  },
  {
    n: "06",
    bg: "bg-white",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#2f5daa]",
  },
];

export default function TechPageContent({ t }: { t: Messages["technology"] }) {
  const STEPS = STEP_STYLES.map((style, i) => ({ ...style, ...t.steps[i] }));
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const [navVisible, setNavVisible] = useState(false);

  function scrollToStep(n: string) {
    const el = document.getElementById(`tech-step-${n}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const triggers: ScrollTrigger[] = [];

    // Show pill nav after intro section scrolls by
    const introEl = document.getElementById("tech-intro");
    if (introEl) {
      triggers.push(
        ScrollTrigger.create({
          trigger: introEl,
          start: "bottom 70%",
          onEnter: () => setNavVisible(true),
          onLeaveBack: () => setNavVisible(false),
        })
      );
    }

    // Scroll-spy: track active step
    STEP_STYLES.forEach((step, idx) => {
      const el = document.getElementById(`tech-step-${step.n}`);
      if (!el) return;
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: "top 45%",
          end: "bottom 45%",
          onEnter: () => setActive(idx),
          onEnterBack: () => setActive(idx),
        })
      );
    });

    if (prefersReduced) return () => triggers.forEach((t) => t.kill());

    // Step entrance animations — distinct per step
    const ctx = gsap.context(() => {
      STEP_STYLES.forEach((step, idx) => {
        const numSel = `#tech-step-${step.n} .step-num`;
        const bodySel = `#tech-step-${step.n} .step-body`;
        const st = {
          trigger: `#tech-step-${step.n}`,
          start: "top 82%",
          toggleActions: "play reverse play reverse",
        };

        // Each step: unique number reveal
        if (idx === 0) {
          // 01 Feasibility: clip-path wipe from top → bottom
          gsap.fromTo(numSel,
            { clipPath: "inset(0 0 100% 0)" },
            { clipPath: "inset(0 0 0% 0)", duration: 0.75, ease: "power3.out", scrollTrigger: st }
          );
        } else if (idx === 1) {
          // 02 System Design: scale + fade pop (engineering precision snapping into place)
          gsap.fromTo(numSel,
            { opacity: 0, scale: 0.5 },
            { opacity: 0.18, scale: 1, duration: 0.75, ease: "back.out(1.7)", scrollTrigger: st }
          );
        } else if (idx === 2) {
          // 03 Procurement: slide in from left
          gsap.fromTo(numSel,
            { opacity: 0, x: -60 },
            { opacity: 0.18, x: 0, duration: 0.7, ease: "power3.out", scrollTrigger: st }
          );
        } else if (idx === 3) {
          // 04 Construction: rotate + scale (heavy machinery feel)
          gsap.fromTo(numSel,
            { opacity: 0, rotation: -18, scale: 0.75, transformOrigin: "center" },
            { opacity: 0.18, rotation: 0, scale: 1, duration: 0.7, ease: "power2.out", scrollTrigger: st }
          );
        } else if (idx === 4) {
          // 05 Commissioning: rise from below (lifting into final position)
          gsap.fromTo(numSel,
            { opacity: 0, y: 50 },
            { opacity: 0.18, y: 0, duration: 0.7, ease: "power3.out", scrollTrigger: st }
          );
        } else {
          // 06 O&M: double flash (ongoing pulse, like a heartbeat monitor)
          const tl = gsap.timeline({ scrollTrigger: st });
          tl.fromTo(numSel, { opacity: 0 }, { opacity: 0.18, duration: 0.12, ease: "none" })
            .to(numSel, { opacity: 0.05, duration: 0.1, ease: "none" })
            .to(numSel, { opacity: 0.18, duration: 0.12, ease: "none" })
            .to(numSel, { opacity: 0.07, duration: 0.08, ease: "none" })
            .to(numSel, { opacity: 0.18, duration: 0.15, ease: "power2.out" });
        }

        // Content entrance: all slide from below, staggered slightly per step index
        gsap.fromTo(bodySel,
          { opacity: 0, y: 22, immediateRender: false },
          {
            opacity: 1, y: 0, duration: 0.65, ease: "power3.out",
            scrollTrigger: { ...st, start: "top 78%" },
          }
        );
      });
    }, containerRef);

    return () => {
      ctx.revert();
      triggers.forEach((t) => t.kill());
    };
  }, []);

  return (
    <div ref={containerRef}>
      {/* Intro section — dark navy */}
      <section id="tech-intro" className="bg-[#091c3c] pt-[calc(var(--header-h)+3rem)] pb-16">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-[1fr_0.6fr] gap-12 items-end">
            <div>
              <h1
                className="font-display text-white font-medium leading-[0.95] text-balance"
                style={{ fontSize: "clamp(2.4rem,7vw,5.5rem)" }}
              >
                {t.title}
              </h1>
              <p className="mt-8 text-white/55 max-w-[50ch] leading-relaxed text-lg">
                {t.intro}
              </p>
            </div>
            <div className="hidden lg:block">
              <div className="flex flex-col gap-1.5">
                {STEPS.map((s, idx) => (
                  <button
                    key={s.n}
                    onClick={() => scrollToStep(s.n)}
                    className={`group flex items-center gap-3 text-sm font-utility text-left transition-colors duration-300 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7a800] ${
                      active === idx ? "text-[#f7a800]" : "text-white/60 hover:text-white/65"
                    }`}
                  >
                    <span className={`font-display text-lg transition-colors duration-300 shrink-0 ${active === idx ? "text-[#f7a800] font-bold" : "text-white/20"}`}>
                      {s.n}
                    </span>
                    <span className={active === idx ? "font-semibold" : ""}>{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fixed pill scroll-spy nav — appears after the intro scrolls by. It sits in the
          page's side margin, so it only shows where it fits there: numbers only from
          1440 px (an 80 px margin), with labels from 1680 px. Below that it would cover
          the right edge of the content. */}
      <div
        inert={!navVisible}
        className={`hidden min-[1440px]:flex fixed right-3 min-[1680px]:right-5 top-1/2 -translate-y-1/2 z-30 flex-col gap-0.5 bg-white/92 backdrop-blur-md rounded-2xl shadow-[0_4px_32px_-8px_rgba(14,42,99,0.18)] p-2.5 border border-[#e4e8ee]/80 transition-[opacity,transform] duration-500 motion-reduce:transition-none ${
          navVisible ? "opacity-100 pointer-events-auto translate-x-0" : "opacity-0 pointer-events-none translate-x-4"
        }`}
      >
        {STEPS.map((step, idx) => (
          <button
            key={step.n}
            onClick={() => scrollToStep(step.n)}
            aria-label={`${step.n} ${step.navLabel}`}
            className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#2f5daa] ${
              active === idx ? "bg-[#0e2a63]/8" : "hover:bg-[#0e2a63]/4"
            }`}
          >
            <span
              className={`text-[10px] font-display font-bold w-5 transition-colors duration-200 ${
                active === idx ? "text-[#2f5daa]" : "text-[#111827]/65 group-hover:text-[#111827]/65"
              }`}
            >
              {step.n}
            </span>
            <span
              aria-hidden="true"
              className={`hidden min-[1680px]:inline text-[10px] font-utility transition-colors duration-200 ${
                active === idx ? "text-[#0e2a63] font-semibold" : "text-[#111827]/65 group-hover:text-[#111827]/70"
              }`}
            >
              {step.navLabel}
            </span>
            <span
              className={`hidden min-[1680px]:block h-1 w-1 rounded-full flex-shrink-0 transition-opacity duration-200 ${
                active === idx ? "bg-[#2f5daa] opacity-100" : "opacity-0"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Step sections */}
      {STEPS.map((step) => (
        <section
          key={step.n}
          id={`tech-step-${step.n}`}
          className={`${step.bg} py-20 md:py-24 border-t ${step.borderColor}`}
        >
          <div className="mx-auto max-w-[1280px] px-6 md:px-10">
            <div className="grid lg:grid-cols-[200px_1fr] gap-8 md:gap-16">
              <div className="flex flex-col">
                <span
                  className={`step-num font-display font-bold ${step.accentColor}`}
                  style={{ fontSize: "clamp(4rem,10vw,8rem)", lineHeight: 1, opacity: 0.18 }}
                >
                  {step.n}
                </span>
                <span className={`font-utility text-[11px] tracking-[0.22em] ${step.accentColor} uppercase mt-auto`}>
                  {t.stepLabel} {step.n}
                </span>
              </div>
              <div className="step-body max-w-[760px]">
                <h2
                  className={`font-display ${step.textColor} font-semibold leading-[1.05]`}
                  style={{ fontSize: "clamp(1.6rem,3.5vw,2.5rem)" }}
                >
                  {step.title}
                </h2>
                <p className={`mt-6 ${step.bodyColor} leading-relaxed text-base md:text-lg`}>
                  {step.body}
                </p>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Technical standards section */}
      <section className="bg-[#f7f9fc] py-20 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <h2
                className="font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.6rem,3.5vw,2.5rem)" }}
              >
                {t.standardsTitle}
              </h2>
              <div className="mt-9 space-y-5">
                {t.standards.map((c) => (
                  <div key={c} className="flex gap-4 items-start">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#f7a800] shrink-0" />
                    <p className="text-[#111827]/70 leading-relaxed">{c}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden">
              <Image
                src={techPhoto}
                alt={t.standardsAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
