"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import techPhoto from "@/public/images/TECHNOLOGY ENGINEERING.webp";
import CTASection from "@/components/CTASection";

const STEPS = [
  {
    n: "01",
    title: "Feasibility Analysis",
    body: "Before any design work begins, we assess the site on every relevant dimension: solar irradiance data, shadow-casting obstructions, structural condition of the mounting surface, proximity to the grid interconnection point, and financial inputs for payback modelling. A feasibility study that misses one of these dimensions can invalidate a project post-construction.",
    bg: "bg-[#f7f9fc]",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#2f5daa]",
    navLabel: "Feasibility",
  },
  {
    n: "02",
    title: "System Design",
    body: "We develop the complete electrical design package: module layout optimised for available surface area and shadow avoidance, string grouping, inverter selection, DC cable sizing and routing, AC switchgear specification, single-line diagram and protection coordination. All designs are developed using industry-standard engineering simulation software to validate yield projections against actual site inputs.",
    bg: "bg-white",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#2f5daa]",
    navLabel: "System Design",
  },
  {
    n: "03",
    title: "Procurement",
    body: "We source high-efficiency solar PV modules from reputed, certified manufacturers with proven performance data and bankable warranties. Inverters, mounting structures, cables, protection devices and balance-of-system components are procured against pre-agreed specifications — no substitutions without client sign-off. Robust vendor relationships ensure consistent quality and timely supply, even on multi-site government programmes.",
    bg: "bg-[#091c3c]",
    textColor: "text-white",
    bodyColor: "text-white/60",
    borderColor: "border-white/10",
    accentColor: "text-[#f7a800]",
    navLabel: "Procurement",
  },
  {
    n: "04",
    title: "Construction",
    body: "Civil works, mounting structure installation, module racking, wiring and conduit installation are all executed to documented quality standards. Our site teams are supervised by experienced project engineers who enforce compliance with both our internal standards and applicable electrical safety regulations. Progress is documented photographically at every major milestone.",
    bg: "bg-[#0e2a63]",
    textColor: "text-white",
    bodyColor: "text-white/60",
    borderColor: "border-white/10",
    accentColor: "text-[#f7a800]",
    navLabel: "Construction",
  },
  {
    n: "05",
    title: "Commissioning",
    body: "Before handover, every system undergoes a structured commissioning protocol: insulation resistance tests, IV curve checks on each string, inverter functional testing, protection relay verification and DISCOM synchronisation check. Systems are only handed over with a complete test report and operating manual. We don't commission against a deadline — we commission against a standard.",
    bg: "bg-[#f7f9fc]",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#f7a800]",
    navLabel: "Commissioning",
  },
  {
    n: "06",
    title: "Operation & Maintenance",
    body: "Commissioning is the beginning, not the end. We offer structured O&M programmes that include scheduled preventive maintenance, corrective fault response, thermographic inspection, string performance analysis and yield reporting. Degradation is tracked against modelled projections, and any underperformance is investigated and addressed — not noted and ignored.",
    bg: "bg-white",
    textColor: "text-[#0e2a63]",
    bodyColor: "text-[#111827]/65",
    borderColor: "border-[#e4e8ee]",
    accentColor: "text-[#2f5daa]",
    navLabel: "O&M",
  },
];

export default function TechPageContent() {
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
    STEPS.forEach((step, idx) => {
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
      STEPS.forEach((step, idx) => {
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
                Engineering standards, not shortcuts.
              </h1>
              <p className="mt-8 text-white/55 max-w-[50ch] leading-relaxed text-lg">
                Every Grid Nova project follows the same six-stage engineering
                process — documented, supervised and signed off at each
                transition.
              </p>
            </div>
            <div className="hidden lg:block">
              <div className="flex flex-col gap-1.5">
                {STEPS.map((s, idx) => (
                  <button
                    key={s.n}
                    onClick={() => scrollToStep(s.n)}
                    className={`group flex items-center gap-3 text-sm font-utility text-left transition-all duration-300 py-1 ${
                      active === idx ? "text-[#f7a800]" : "text-white/35 hover:text-white/65"
                    }`}
                  >
                    <span className={`font-display text-lg transition-all duration-300 shrink-0 ${active === idx ? "text-[#f7a800] font-bold" : "text-white/20"}`}>
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

      {/* Fixed pill scroll-spy nav — appears after intro scrolls by, desktop xl+ only */}
      <div
        className={`hidden xl:flex fixed right-5 top-1/2 -translate-y-1/2 z-30 flex-col gap-0.5 bg-white/92 backdrop-blur-md rounded-2xl shadow-[0_4px_32px_-8px_rgba(14,42,99,0.18)] p-2.5 border border-[#e4e8ee]/80 transition-all duration-500 ${
          navVisible ? "opacity-100 pointer-events-auto translate-x-0" : "opacity-0 pointer-events-none translate-x-4"
        }`}
      >
        {STEPS.map((step, idx) => (
          <button
            key={step.n}
            onClick={() => scrollToStep(step.n)}
            className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all duration-200 ${
              active === idx ? "bg-[#0e2a63]/8" : "hover:bg-[#0e2a63]/4"
            }`}
          >
            <span
              className={`text-[10px] font-display font-bold w-5 transition-colors duration-200 ${
                active === idx ? "text-[#2f5daa]" : "text-[#111827]/25 group-hover:text-[#111827]/55"
              }`}
            >
              {step.n}
            </span>
            <span
              className={`text-[10px] font-utility transition-all duration-200 ${
                active === idx ? "text-[#0e2a63] font-semibold" : "text-[#111827]/40 group-hover:text-[#111827]/70"
              }`}
            >
              {step.navLabel}
            </span>
            <span
              className={`h-1 w-1 rounded-full flex-shrink-0 transition-all duration-200 ${
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
                  Step {step.n}
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
                Built to certified standards.
              </h2>
              <div className="mt-9 space-y-5">
                {[
                  "High-efficiency solar PV modules sourced from certified manufacturers with BIS/IEC certifications.",
                  "Advanced inverters meeting international performance benchmarks and DISCOM interconnection requirements.",
                  "System design validated using industry-standard engineering software tools for yield simulation and shadow analysis.",
                  "Full compliance with MNRE guidelines, Central Electricity Authority regulations and applicable state DISCOM interconnection standards.",
                ].map((c) => (
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
                alt="Grid Nova Energy technician testing electrical protection panels with a multimeter inside an inverter room"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
}
