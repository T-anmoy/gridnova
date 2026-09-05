import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import coverPhoto from "@/public/images/PROJECTS COVER.webp";
import showaPhoto from "@/public/images/1.3 MWp SHOWA INDIA.webp";
import streetLightingPhoto from "@/public/images/STREET LIGHTING.webp";
import schoolsPhoto from "@/public/images/WBREDA SCHOOLS.webp";
import pmKusumPhoto from "@/public/images/PM KUSUM.webp";
import pmSuryaGharPhoto from "@/public/images/PM SURYA GHAR.webp";
import CountUp from "@/components/CountUp";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { statCellClass } from "@/lib/stat-grid";

export const metadata: Metadata = pageMetadata({
  title: "Projects",
  description:
    "Grid Nova Energy project index — street lighting, institutional electrification, agricultural pumps, residential and industrial solar EPC across West Bengal and Bihar.",
  path: "/projects",
});

const STATS = [
  { value: "4,800+", label: "Street lamps installed" },
  { value: "330+", label: "10kW WBREDA schools" },
  { value: "2,350+", label: "PM-KUSUM solar pumps" },
  { value: "1,200+", label: "Residential — PM Surya Ghar" },
];

const DISTRICTS = [
  "Patna", "Jehanabad", "Purnia", "Katihar", "Nawada", "Seohar",
  "Hooghly", "Burdwan", "Malda", "Midnapore", "Barasat", "Kolkata",
];

export default function ProjectsPage() {
  return (
    <main>
      {/* Stats dashboard — data-forward, cover photo behind */}
      <section className="relative overflow-hidden pt-[calc(var(--header-h)+2.5rem)] pb-0">
        <Image
          src={coverPhoto}
          alt="Grid Nova engineers reviewing site plans in front of a utility-scale solar array and substation"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center -z-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#091c3c]/92 via-[#091c3c]/60 to-[#091c3c] -z-10" />
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <p className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase mb-6">
            Project Index — West Bengal &amp; Bihar
          </p>
          <h1
            className="font-display text-white font-medium leading-[0.95] text-balance max-w-[18ch]"
            style={{ fontSize: "clamp(2.2rem,6vw,4.5rem)" }}
          >
            Execution at scale, across every segment.
          </h1>
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 border-t border-white/10">
            {STATS.map(({ value, label }, i) => {
              const cls = statCellClass(i, STATS.length);
              return (
                <div key={label} className={cls}>
                  <div className="font-display text-white font-bold" style={{ fontSize: "clamp(1.8rem,5vw,3.5rem)" }}>
                    <CountUp value={value} />
                  </div>
                  <div className="mt-2 text-white/45 text-xs font-utility leading-snug">{label}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 pb-2 text-white/40 text-xs font-utility leading-relaxed max-w-[62ch]">
            Delivered by Grid Nova&rsquo;s team and branch network across West
            Bengal &amp; Bihar.
          </p>
        </div>
      </section>

      {/* Featured case study — Showa India */}
      <section className="bg-white py-16 md:py-20 border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-px w-8 bg-[#f7a800]" />
            <span className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/40 uppercase">Featured Case Study</span>
          </div>
          <ScrollReveal>
          <div className="grid lg:grid-cols-[1fr_0.7fr] gap-10 items-stretch">
            <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden">
              <Image
                src={showaPhoto}
                alt="1.3 MWp industrial rooftop solar array, Showa India, Faridabad"
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover object-center"
              />
            </div>
            <div className="rounded-2xl border border-[#e4e8ee] bg-[#f7f9fc] p-7 md:p-9 flex flex-col justify-between">
              <div>
                <h2 className="font-display text-[#0e2a63] text-3xl font-semibold">1.3 MWp Solar EPC</h2>
                <p className="mt-1.5 text-[#111827]/55 font-utility text-sm flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  Showa India, Faridabad, Haryana
                </p>
                <p className="mt-6 text-[#111827]/65 leading-relaxed">
                  A full-scale industrial solar EPC project delivered by Grid
                  Nova&rsquo;s team and branch network for Showa India in
                  Faridabad. Scope covered the complete project lifecycle:
                  initial site assessment, shadow and structural analysis,
                  electrical system design, procurement of modules, inverters
                  and balance-of-system, full installation and commissioning,
                  and handover documentation package.
                </p>
                <p className="mt-4 text-[#111827]/65 leading-relaxed">
                  This project demonstrates the capacity of Grid Nova&rsquo;s
                  team and branch network to manage large-scale,
                  performance-critical industrial solar installations with full
                  accountability from design to handover.
                </p>
              </div>
              <Link
                href="/contact"
                className="mt-8 inline-flex items-center gap-1.5 text-[#0e2a63] font-utility text-sm font-semibold group w-fit active:scale-[0.97] transition-transform"
              >
                Discuss a similar project
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Category sections */}
      {[
        {
          id: "street-lighting",
          label: "Street Lighting",
          stat: "4,800+",
          statLabel: "Solar street lamps installed",
          description: "Solar-powered street lighting deployed across rural districts in West Bengal and Bihar under state and central government electrification programmes. Each installation covers supply, installation and commissioning of the complete lamp assembly, including pole, module, battery and controller.",
          photo: streetLightingPhoto,
          photoAlt: "Solar street lighting installation — Grid Nova Energy",
        },
        {
          id: "institutional",
          label: "Institutional — Schools",
          stat: "330+",
          statLabel: "10kW schools electrified (WBREDA)",
          description: "Grid electrification of 330+ schools across West Bengal for the West Bengal Renewable Energy Development Agency (WBREDA). Each school received a 10kW grid-connected rooftop system covering design, supply, installation, testing and commissioning, under strict government programme quality and documentation standards.",
          photo: schoolsPhoto,
          photoAlt: "Grid Nova technicians installing rooftop solar panels at a WBREDA-programme school as students walk past below",
        },
        {
          id: "agricultural",
          label: "Agricultural — PM Kusum",
          stat: "2,350+",
          statLabel: "Solar pumps installed",
          description: "Solarisation of agricultural pump sets across West Bengal and Bihar under PM Kusum Component C. Each installation provides farmers with a solar-powered water pumping system replacing diesel or grid power, reducing operating costs and enabling more reliable irrigation. Grid Nova's team and branch network managed procurement, installation and commissioning for each site.",
          photo: pmKusumPhoto,
          photoAlt: "PM Kusum solar pump installation — Grid Nova Energy",
        },
        {
          id: "residential",
          label: "Residential — PM Surya Ghar",
          stat: "1,200+",
          statLabel: "Residential systems installed",
          description: "Residential rooftop solar installations under PM Surya Ghar across West Bengal and Bihar. Grid Nova's team and branch network handled the complete customer journey: site survey, system design, DISCOM interconnection application, installation, commissioning and government subsidy documentation. Every customer received a net-metering connection as part of the standard scope.",
          photo: pmSuryaGharPhoto,
          photoAlt: "Grid Nova technician demonstrating the rooftop solar inverter to a residential customer under PM Surya Ghar",
        },
      ].map((cat, idx) => (
        <section
          key={cat.id}
          className={`py-16 md:py-20 border-b border-[#e4e8ee] ${idx % 2 === 0 ? "bg-[#f7f9fc]" : "bg-white"}`}
        >
          <div className="mx-auto max-w-[1280px] px-6 md:px-10">
            <ScrollReveal x={idx % 2 !== 0 ? 24 : -24} y={0}>
            <div className="grid lg:grid-cols-[1fr_0.85fr] gap-12 lg:gap-20 items-center">
              <div className={idx % 2 !== 0 ? "lg:order-2" : ""}>
                <span className="font-utility text-[11px] tracking-[0.22em] text-[#2f5daa]/60 uppercase">{cat.label}</span>
                <div className="mt-3 font-display text-[#0e2a63] font-bold" style={{ fontSize: "clamp(2.5rem,7vw,5rem)" }}>
                  <CountUp value={cat.stat} />
                </div>
                <p className="mt-1 text-[#111827]/45 text-sm font-utility">{cat.statLabel}</p>
                <p className="mt-6 text-[#111827]/65 leading-relaxed max-w-[52ch]">{cat.description}</p>
              </div>
              <div className={`relative aspect-[4/3] w-full rounded-2xl overflow-hidden ${idx % 2 !== 0 ? "lg:order-1" : ""}`}>
                <Image
                  src={cat.photo}
                  alt={cat.photoAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover object-center"
                />
              </div>
            </div>
            </ScrollReveal>
          </div>
        </section>
      ))}

      {/* Districts covered */}
      <section className="bg-[#0e2a63] py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end gap-8 mb-10">
            <div>
              <p className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase mb-3">Geographic Footprint</p>
              <h2 className="font-display text-white font-semibold text-2xl md:text-3xl">Districts covered</h2>
            </div>
            <p className="text-white/50 text-sm max-w-[44ch] md:ml-auto">
              Our operational footprint spans West Bengal and Bihar, with projects
              in districts across rural and semi-urban areas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {DISTRICTS.map((d) => (
              <span
                key={d}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/70 text-sm font-utility"
              >
                {d}
              </span>
            ))}
            <span className="rounded-full px-4 py-2 text-white/40 text-sm font-utility">
              + additional districts
            </span>
          </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
