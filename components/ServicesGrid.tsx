"use client";

import { useEffect, useRef } from "react";
import Image, { type StaticImageData } from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/Link";
import TiltCard from "./TiltCard";
import { observeRevealGroup } from "@/lib/reveal";
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
// `focus` keeps each photo's subject in frame when it is cropped to the card's
// shape (the two portrait photos are cropped hardest).
const PHOTOS: Record<string, { src: StaticImageData; focus: string }> = {
  rooftop: { src: rooftopPhoto, focus: "40% 62%" },
  epc: { src: epcPhoto, focus: "50% 50%" },
  schools: { src: schoolsPhoto, focus: "62% 38%" },
  "street-lighting": { src: streetPhoto, focus: "38% 50%" },
  "solar-pumps": { src: pumpsPhoto, focus: "55% 45%" },
  om: { src: omPhoto, focus: "55% 55%" },
  consulting: { src: consultingPhoto, focus: "62% 62%" },
};

// Rendered photo widths, matched to the layout below (container 1280 px, 40 px
// side padding from md, 24 px under md, 20 px gaps). Featured: full card width
// until lg, then 1.15 of 2.15 columns. Rows: full width, then half under lg.
// From lg a row's photo is a narrow column as tall as the text (up to ~300 px),
// so the 4:3 photo is cropped by height and needs about 300 × 1.34 px of width.
const FEATURED_SIZES = "(min-width: 1280px) 642px, (min-width: 1024px) calc(53.5vw - 43px), (min-width: 768px) calc(100vw - 80px), calc(100vw - 48px)";
const ROW_SIZES = "(min-width: 1024px) 400px, (min-width: 768px) calc(50vw - 50px), calc(100vw - 48px)";

export default function ServicesGrid({ t }: { t: Messages["home"]["services"] }) {
  const ref = useRef<HTMLElement>(null);
  const [featured, ...rest] = t.rows;

  // Cards rise in with a short stagger as the section arrives (CSS
  // transitions on the shared reveal observer; visible without JavaScript).
  useEffect(() => {
    const el = ref.current;
    return el ? observeRevealGroup(el, ".service-card", 0.08, () => ({ "--reveal-y": "40px" })) : undefined;
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
            className="group grid lg:grid-cols-[1.15fr_1fr] rounded-2xl overflow-hidden border border-[#e4e8ee] bg-white hover:border-[#2f5daa]/40 transition-colors duration-300"
          >
            {/* Photo on top at a fixed 16:10 until the card is wide enough to sit beside the text. */}
            <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[360px] overflow-hidden">
              <Image
                src={PHOTOS[featured.id].src}
                alt={featured.alt}
                fill
                sizes={FEATURED_SIZES}
                style={{ objectPosition: PHOTOS[featured.id].focus }}
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
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
        {/* Under lg each card stacks: a 3:2 photo over the text. From lg the photo
            takes 2/5 of the card beside the text. Cards in a row share one height
            (h-full); the photo fills its column with object-cover, never stretched. */}
        <div className="mt-5 grid md:grid-cols-2 gap-5">
          {rest.map((row) => (
            <TiltCard key={row.id} className="service-card h-full" intensity={4}>
              <Link
                href={`/services#${row.id}`}
                className="group flex flex-col lg:grid lg:grid-cols-[2fr_3fr] h-full rounded-2xl overflow-hidden border border-[#e4e8ee] bg-white hover:border-[#2f5daa]/40 transition-colors duration-300"
              >
                <div className="relative aspect-[3/2] lg:aspect-auto lg:min-h-[200px] overflow-hidden">
                  <Image
                    src={PHOTOS[row.id].src}
                    alt={row.alt}
                    fill
                    sizes={ROW_SIZES}
                    style={{ objectPosition: PHOTOS[row.id].focus }}
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
