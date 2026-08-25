import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import residentialPhoto from "@/public/images/RESIDENTIAL.webp";
import commercialPhoto from "@/public/images/COMMERCIAL.webp";
import industrialPhoto from "@/public/images/INDUSTRIAL.webp";
import CTASection from "@/components/CTASection";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = pageMetadata({
  title: "Industries We Serve",
  description:
    "Grid Nova Energy delivers solar EPC and O&M solutions for residential, commercial, industrial and government clients across India.",
  path: "/industries",
});

export default function IndustriesPage() {
  return (
    <main>
      {/* No eyebrow, no hero formula — large typographic opener */}
      <section className="pt-[calc(var(--header-h)+3rem)] pb-12 bg-white border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal y={32}>
          <h1
            className="font-display text-[#0e2a63] font-medium leading-[0.95] text-balance"
            style={{ fontSize: "clamp(1.75rem,8vw,7rem)" }}
          >
            Four markets.
            <span className="block text-[#f7a800]">One standard.</span>
          </h1>
          </ScrollReveal>
        </div>
      </section>

      {/* Residential — warm, human, image right */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-20 items-center">
            <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden lg:order-2">
              <Image
                src={residentialPhoto}
                alt="Grid Nova technician showing a homeowner the rooftop solar inverter after installation"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-center"
              />
            </div>
            <div className="lg:order-1">
              <div className="inline-flex items-center gap-3 mb-8">
                <span className="h-px w-10 bg-[#f7a800]" />
                <span className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/45 uppercase">Residential</span>
              </div>
              <h2
                className="font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                Energy independence for homeowners and housing societies.
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed max-w-[52ch]">
                We design and install rooftop solar systems for individual
                homeowners and multi-unit housing societies seeking to reduce
                electricity bills and gain independence from grid tariff
                volatility. Our residential scope includes full PM Surya Ghar
                subsidy documentation, net-metering DISCOM application and
                post-installation performance support.
              </p>
              <ul className="mt-8 space-y-3">
                {["PM Surya Ghar subsidy handling", "Net-metering DISCOM application", "Structural load assessment", "Long-term performance support"].map((i) => (
                  <li key={i} className="flex gap-3 items-center text-[#111827]/70 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f7a800] shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Commercial — clean white, horizontal editorial split */}
      <section className="bg-[#f7f9fc] py-20 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20 items-center">
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
              <Image
                src={commercialPhoto}
                alt="Grid Nova technicians wiring rooftop solar panels across a dense commercial building complex"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-center"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-3 mb-8">
                <span className="h-px w-10 bg-[#f7a800]" />
                <span className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/45 uppercase">Commercial</span>
              </div>
              <h2
                className="font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                Reducing operating costs for offices, hospitals and institutions.
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed">
                Commercial buildings typically run high daytime loads that align
                closely with peak solar generation hours — making rooftop and
                carport solar installations financially compelling within 3–5
                year payback windows. We handle the full process from energy
                audit and system design through procurement, installation and
                ongoing O&amp;M.
              </p>
              <p className="mt-4 text-[#111827]/65 leading-relaxed">
                Clients include office campuses, hospitals, hotels and educational
                institutions across West Bengal and beyond.
              </p>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Industrial — full dark navy section */}
      <section className="bg-[#091c3c] py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden lg:order-2">
              <Image
                src={industrialPhoto}
                alt="Grid Nova technicians inspecting an electrical enclosure on an industrial warehouse rooftop solar installation"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
            <div className="lg:order-1">
              <div className="inline-flex items-center gap-3 mb-8">
                <span className="h-px w-10 bg-[#f7a800]" />
                <span className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase">Industrial</span>
              </div>
              <h2
                className="font-display text-white font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                Reducing energy costs and improving sustainability metrics.
              </h2>
              <p className="mt-6 text-white/60 leading-relaxed">
                Manufacturing plants, warehouses and processing facilities carry
                high, consistent power loads — exactly the profile where large
                rooftop or ground-mount solar delivers maximum financial return.
                We work directly with plant engineering teams to minimise
                production disruption during installation and ensure the system
                integrates cleanly with existing power management infrastructure.
              </p>
              <p className="mt-4 text-white/60 leading-relaxed">
                The 1.3 MWp EPC project delivered by Grid Nova&rsquo;s team and
                branch network for Showa India in Faridabad is the clearest
                demonstration of that industrial execution capability — a
                full-scale delivery managed across design, procurement,
                construction and commissioning phases.
              </p>
              <Link
                href="/projects"
                className="mt-8 inline-flex items-center gap-2 text-[#f7a800] font-utility text-sm font-semibold group active:scale-[0.97] transition-transform"
              >
                See the Showa India case study
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Government & Institutional */}
      <section className="bg-[#0e2a63] py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="inline-flex items-center gap-3 mb-10">
            <span className="h-px w-10 bg-[#f7a800]" />
            <span className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase">Government &amp; Institutional</span>
          </div>
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-20 items-end">
            <div>
              <h2
                className="font-display text-white font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                Public projects aligned with national renewable energy targets.
              </h2>
              <p className="mt-6 text-white/60 leading-relaxed">
                Grid Nova&rsquo;s team and branch network brings extensive
                experience executing projects under national government solar
                programmes — including the electrification of
                330+ 10kW schools for WBREDA, 2,350+ agricultural pump installations
                under PM-KUSUM, and 4,800+ solar street lamps across rural
                districts. Government projects demand rigorous compliance
                documentation, transparent procurement and proven execution
                capacity. We have the track record.
              </p>
              <p className="mt-6 text-white/40 text-xs font-utility leading-relaxed max-w-[52ch]">
                Delivered by Grid Nova&rsquo;s team and branch network across West
                Bengal &amp; Bihar.
              </p>
            </div>
            <div className="lg:text-right space-y-8">
              {[["330+", "10kW schools electrified"], ["2,350+", "PM-KUSUM pumps"], ["4,800+", "Street lamps"]].map(([n, l]) => (
                <div key={l}>
                  <div className="font-display text-[#f7a800] font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{n}</div>
                  <div className="text-white/50 text-sm font-utility mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      <CTASection />
    </main>
  );
}
