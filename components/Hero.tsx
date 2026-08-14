"use client";

import { useEffect, useRef } from "react";
import { getImageProps } from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import CountUp from "./CountUp";
import MagneticButton from "./MagneticButton";

const STATS = [
  { num: "4,800+", label: "Street lamps installed" },
  { num: "330+", label: "10kW WBREDA schools" },
  { num: "2,350+", label: "Solar pumps — PM-KUSUM" },
  { num: "1,200+", label: "Residential — PM Surya Ghar" },
] as const;

export default function Hero() {
  // Art-directed hero — one image downloads per device width
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    src: "/hero/hero-desktop.webp",
    alt: "Grid Nova Energy engineers walking a utility-scale solar installation at sunset",
    fill: true,
    priority: true,
    sizes: "100vw",
    quality: 85,
  });
  const {
    props: mobileImgProps,
  } = getImageProps({
    src: "/hero/hero-mobile.webp",
    alt: "Grid Nova Energy engineers walking a utility-scale solar installation at sunset",
    fill: true,
    priority: true,
    sizes: "100vw",
    quality: 80,
  });

  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Image drifts down as page scrolls — creates parallax at ~30% lag vs. viewport
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      // 1 — photo fades in first
      tl.fromTo(".hero-photo-wrap", { opacity: 0 }, { opacity: 1, duration: 0.85 }, 0)
        // 2 — stats panel slides in from right
        .fromTo(".hero-panel", { opacity: 0, x: 32 }, { opacity: 1, x: 0, duration: 0.9 }, 0.45)
        // 3 — eyebrow
        .fromTo(".hero-eyebrow", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65 }, 0.58)
        // 4 — headline lines stagger up through clip
        .fromTo(".hero-line", { opacity: 0, y: "100%" }, { opacity: 1, y: "0%", duration: 0.85, stagger: 0.11 }, 0.68)
        // 5 — sub copy
        .fromTo(".hero-sub", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65 }, "-=0.5")
        // 6 — CTAs
        .fromTo(".hero-cta", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 }, "-=0.42")
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100svh] w-full overflow-hidden flex items-center"
    >
      {/* ── Parallax container (Framer y-transform only) ── */}
      <motion.div
        className="absolute"
        style={{
          left: 0, right: 0,
          top: "-15%", bottom: "-15%",
          y: imgY,
        }}
      >
        {/* ── Opacity wrapper (GSAP fade, separate element from Framer) ── */}
        <div className="hero-photo-wrap absolute inset-0">
          {/* ── Ken Burns scale (CSS keyframe, separate from both above) ── */}
          <div className="ken-burns absolute inset-0">
            {/* picture: browser picks one source — no double download */}
            <picture>
              <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
              {/* img spread carries fill styles + mobile srcSet from getImageProps */}
              <img
                {...mobileImgProps}
                alt="Grid Nova Energy engineers walking a utility-scale solar installation at sunset"
                className="object-cover object-[center_28%] md:object-center"
              />
            </picture>
          </div>
        </div>
      </motion.div>

      {/* ── Legibility scrims — tuned for WCAG AA across breakpoints ── */}
      {/* Left-to-right: text column protection at /90, fades to nothing on right */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#091c3c]/90 via-[#091c3c]/50 to-transparent pointer-events-none" />
      {/* Bottom-to-top: depth and anchor to ground */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#091c3c]/65 via-transparent to-[#091c3c]/20 pointer-events-none" />
      {/* Narrow column booster: extra protection over the left half only on large screens */}
      <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#091c3c]/25 to-transparent pointer-events-none hidden lg:block" />

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-6 md:px-10 pt-[calc(var(--header-h)+1rem)] pb-24">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-end">
          <div>
            <span className="hero-eyebrow ref-tag text-[#f7a800]">
              Eco-Energy Initiative — Since Inception
            </span>
            <h1
              className="mt-6 font-display text-white leading-[0.98] font-medium"
              style={{ fontSize: "clamp(2rem,13vw,3.5rem)" }}
            >
              <span className="overflow-hidden block">
                <span className="hero-line block">Engineering</span>
              </span>
              <span className="overflow-hidden block">
                <span className="hero-line block">India&rsquo;s Clean</span>
              </span>
              <span className="overflow-hidden block">
                <span className="hero-line block text-transparent bg-clip-text bg-gradient-to-r from-[#f7a800] to-[#fde68a] [filter:drop-shadow(0_2px_16px_rgba(9,28,60,0.9))]">
                  Energy Grid.
                </span>
              </span>
            </h1>
            <p className="hero-sub mt-8 max-w-[46ch] text-white/85 text-base md:text-lg leading-relaxed [text-shadow:0_1px_8px_rgba(9,28,60,0.6)]">
              Grid Nova Energy designs, procures and constructs solar
              infrastructure for residential, commercial, industrial and
              government clients — engineered for performance over the full
              lifecycle, not just the day it&rsquo;s switched on.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <MagneticButton>
                <Link
                  href="/contact"
                  className="hero-cta group inline-flex items-center gap-2 rounded-full bg-[#f7a800] text-[#091c3c] font-utility font-semibold text-sm px-6 py-3.5 hover:bg-white transition-colors duration-300 active:scale-[0.97]"
                >
                  Start a Project
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </MagneticButton>
              <Link
                href="/projects"
                className="hero-cta inline-flex items-center gap-2 rounded-full border border-white/30 text-white font-utility text-sm px-6 py-3.5 hover:bg-white/12 hover:border-white/50 transition-all duration-300 active:scale-[0.97]"
              >
                View Our Work
              </Link>
            </div>
          </div>

          <div
            className="hero-panel glass rounded-3xl p-6 md:p-7"
            style={{ backgroundColor: "rgba(4,14,40,0.80)" }}
          >
            <p className="ref-tag text-white/50">The Grid Nova Team&rsquo;s Track Record</p>
            <div className="mt-5 grid grid-cols-2 gap-x-6 xs:gap-x-8 gap-y-5">
              {STATS.map(({ num, label }) => (
                <div key={label}>
                  <div className="font-display text-white text-2xl md:text-[28px] font-semibold">
                    <CountUp value={num} />
                  </div>
                  <div className="text-white/80 text-xs font-utility mt-1 leading-snug">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-white/45 text-[11px] font-utility leading-snug">
              Delivered by Grid Nova&rsquo;s team and branch network across West
              Bengal &amp; Bihar.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
