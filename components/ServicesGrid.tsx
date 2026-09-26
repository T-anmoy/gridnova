"use client";

import { useEffect, useRef } from "react";
import Image, { type StaticImageData } from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/Link";
import TiltCard from "./TiltCard";
import type { Messages } from "@/lib/i18n/types";
import rooftopPhoto from "@/public/images/PM SURYA GHAR.webp";
import epcPhoto from "@/public/images/SOLAR EPC.webp";
import schoolsPhoto from "@/public/images/WBREDA SCHOOLS.webp";
import streetPhoto from "@/public/images/STREET LIGHTING.webp";
import pumpsPhoto from "@/public/images/PM KUSUM.webp";
import omPhoto from "@/public/images/Inverter Room.webp";
import consultingPhoto from "@/public/images/TECHNOLOGY ENGINEERING.webp";

// Each row has its own real photo and links to its own section on /services.
// Row text (title, copy, one line of proof where a documented figure exists)
// comes from messages: home.services.rows, keyed by id.
const PHOTOS: Record<string, StaticImageData> = {
  rooftop: rooftopPhoto,
  epc: epcPhoto,
  schools: schoolsPhoto,
  "street-lighting": streetPhoto,
  "solar-pumps": pumpsPhoto,
  om: omPhoto,
  consulting: consultingPhoto,
};

export default function ServicesGrid({ t }: { t: Messages["home"]["services"] }) {
  const ref = useRef<HTMLElement>(null);
  const [featured, ...rest] = t.rows;

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
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
          <div>
            <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
            <h2
              className="mt-4 font-display text-[#0e2a63] leading-[1.02] font-medium max-w-[18ch] text-balance"
              style={{ fontSize: "clamp(1.5rem,7vw,3rem)" }}
            >
              {t.title}
            </h2>
          </div>
          <p className="max-w-[40ch] text-[#111827]/60 leading-relaxed">{t.intro}</p>
        </div>

        {/* Lead service: full-width editorial row */}
        <TiltCard className="service-card" intensity={3}>
          <Link
            href={`/services#${featured.id}`}
            className="group grid md:grid-cols-[1.15fr_1fr] rounded-2xl overflow-hidden border border-[#e4e8ee] bg-white hover:border-[#2f5daa]/40 transition-colors duration-300"
          >
            <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[340px] overflow-hidden">
              <Image
                src={PHOTOS[featured.id]}
                alt={featured.alt}
                fill
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-7 md:p-10 flex flex-col justify-center">
              {featured.proof && (
                <p className="font-display text-[#b8790a] text-lg md:text-xl font-semibold">{featured.proof}</p>
              )}
              <h3 className="mt-3 font-display text-[#0e2a63] text-2xl md:text-3xl font-semibold text-balance">
                {featured.title}
              </h3>
              <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[46ch]">{featured.copy}</p>
              <span className="btn-text mt-6">
                {t.link}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        </TiltCard>

        {/* Remaining services: two-up photo rows, an even count so no empty cell */}
        <div className="mt-5 grid md:grid-cols-2 gap-5">
          {rest.map((row) => (
            <TiltCard key={row.id} className="service-card" intensity={4}>
              <Link
                href={`/services#${row.id}`}
                className="group grid grid-cols-[112px_1fr] xs:grid-cols-[140px_1fr] h-full rounded-2xl overflow-hidden border border-[#e4e8ee] bg-white hover:border-[#2f5daa]/40 transition-colors duration-300"
              >
                <div className="relative min-h-[150px] overflow-hidden">
                  <Image
                    src={PHOTOS[row.id]}
                    alt={row.alt}
                    fill
                    sizes="140px"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                </div>
                <div className="p-5 md:p-6 flex flex-col">
                  <h3 className="font-display text-[#0e2a63] text-lg font-semibold leading-snug">{row.title}</h3>
                  <p className="mt-1.5 text-[#111827]/60 text-sm leading-relaxed">{row.copy}</p>
                  {row.proof && (
                    <p className="mt-3 font-utility text-sm font-semibold text-[#b8790a]">{row.proof}</p>
                  )}
                </div>
              </Link>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
