"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import TiltCard from "./TiltCard";

const SERVICES = [
  {
    mark: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 6 11h6l-5 7" />
      </svg>
    ),
    title: "Solar EPC Services",
    copy: "End-to-end engineering, procurement and construction of grid-connected and off-grid solar power plants.",
  },
  {
    mark: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 10 10 2l8 8" />
        <path d="M5 10v7h10v-7" />
        <path d="M8 17v-3h4v3" />
      </svg>
    ),
    title: "Green Energy Projects",
    copy: "Distributed and rooftop solar across residential, commercial and industrial profiles — including PM Surya Ghar subsidy installations.",
  },
  {
    mark: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="7" height="4.5" rx="0.5" />
        <rect x="11" y="5" width="7" height="4.5" rx="0.5" />
        <rect x="2" y="10.5" width="7" height="4.5" rx="0.5" />
        <rect x="11" y="10.5" width="7" height="4.5" rx="0.5" />
      </svg>
    ),
    title: "Grid-Scale Solar Infrastructure",
    copy: "Design and execution support for ground-mounted, large-scale solar power plants.",
  },
  {
    mark: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="10" cy="10" r="5" />
        <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
      </svg>
    ),
    title: "Operation & Maintenance",
    copy: "Preventive and corrective maintenance programs that hold system performance year-round.",
  },
  {
    mark: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="1.5" />
        <path d="M6 13l3-4 3 3 3-4.5" />
      </svg>
    ),
    title: "Energy Consulting",
    copy: "Feasibility studies, site assessment, system design and full regulatory & DISCOM support.",
  },
];

export default function ServicesGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(".service-card", { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: "top 78%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative bg-[#f7f9fc] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14 md:mb-20">
          <div>
            <span className="ref-tag text-[#2f5daa]">What We Deliver</span>
            <h2
              className="mt-4 font-display text-[#0e2a63] leading-[1.02] font-medium max-w-[16ch] text-balance"
              style={{ fontSize: "clamp(1.5rem,9vw,3rem)" }}
            >
              Capability across the full solar lifecycle.
            </h2>
          </div>
          <p className="max-w-[38ch] text-[#111827]/60 leading-relaxed">
            From feasibility to commissioning to decades of upkeep — one
            engineering team accountable for every stage.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => (
            <TiltCard
              key={s.title}
              className={`service-card ${i === 0 ? "lg:col-span-2" : ""}`}
            >
              <Link
                href="/services"
                className="group relative rounded-2xl border border-[#e4e8ee] bg-white p-7 md:p-8 hover:border-[#2f5daa]/40 hover:shadow-[0_20px_50px_-20px_rgba(14,42,99,0.25)] transition-all duration-400 active:scale-[0.98] flex flex-col h-full"
              >
                <div className="flex items-start justify-between">
                  <span className="font-utility text-[11px] tracking-[0.15em] text-[#0e2a63]/25">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#0e2a63]/30 group-hover:text-[#f7a800] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
                </div>
                <motion.div
                  whileHover={{ scale: 1.12, rotate: 6 }}
                  whileTap={{ scale: 0.92, rotate: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="mt-6 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0e2a63]/5 text-[#0e2a63] group-hover:bg-[#f7a800]/10 group-hover:text-[#f7a800] transition-colors duration-300"
                >
                  {s.mark}
                </motion.div>
                <h3 className="mt-5 font-display text-[#0e2a63] text-xl font-semibold">{s.title}</h3>
                <p className="mt-2.5 text-[#111827]/60 text-sm leading-relaxed max-w-[42ch]">{s.copy}</p>
              </Link>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
