import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import CountUp from "@/components/CountUp";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = pageMetadata({
  title: "Sustainability & Impact",
  description:
    "How Grid Nova Energy contributes to reducing greenhouse gas emissions and building a more energy-secure India — project by project.",
  path: "/sustainability",
});

const IMPACT = [
  { value: "4,800+", label: "Solar street lamps", note: "Replacing kerosene and diesel-powered lighting in rural communities" },
  { value: "330+", label: "10kW schools electrified", note: "Clean power for education under the WBREDA programme" },
  { value: "2,350+", label: "Agricultural pumps", note: "Farmers freed from diesel costs and fuel availability risk" },
  { value: "1,200+", label: "Residential installations", note: "Households generating their own clean power" },
];

export default function SustainabilityPage() {
  return (
    <main>
      {/* Opening statement — full-bleed green, no eyebrow, no formula hero */}
      <section className="bg-gradient-to-b from-[#002868] to-[#091c3c] pt-[calc(var(--header-h)+3.5rem)] pb-20 md:pb-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <h1
            className="font-display text-white font-medium leading-[1.05] text-balance max-w-[22ch]"
            style={{ fontSize: "clamp(2rem,6vw,4.5rem)" }}
          >
            &ldquo;Every installation is a long-term contribution to a more
            energy-secure India.&rdquo;
          </h1>
          <p className="mt-10 text-white/80 max-w-[56ch] leading-relaxed text-lg">
            Grid Nova Energy actively works to reduce greenhouse gas emissions
            and dependence on fossil fuels across India. Each project supports
            cleaner air for communities, lower operating costs for clients, and
            measurable progress toward the country&rsquo;s national and global
            renewable energy commitments.
          </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Impact metrics — documented numbers only, no invented CO₂ figures */}
      <section className="bg-[#091c3c] py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="mb-12">
            <p className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase mb-4">Documented Impact</p>
            <h2
              className="font-display text-white font-semibold leading-[1.05] max-w-[22ch] text-balance"
              style={{ fontSize: "clamp(1.6rem,3.5vw,2.5rem)" }}
            >
              What we&rsquo;ve actually delivered.
            </h2>
            <p className="mt-5 text-white/50 max-w-[46ch] leading-relaxed text-sm">
              We report only what we can document. These are the installation
              figures from completed and commissioned projects across West
              Bengal and Bihar.
            </p>
          </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {IMPACT.map(({ value, label, note }) => (
              <div key={label} className="bg-[#0c2148] p-8">
                <div className="font-display text-[#f7a800] font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>
                  <CountUp value={value} />
                </div>
                <p className="mt-2 font-display text-white font-semibold text-lg">{label}</p>
                <p className="mt-3 text-white/45 text-sm leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-white/40 text-xs font-utility leading-relaxed max-w-[62ch]">
            Delivered by Grid Nova&rsquo;s team and branch network across West
            Bengal &amp; Bihar.
          </p>
        </div>
      </section>

      {/* What we believe — editorial text, white bg, no decorative chrome */}
      <section className="bg-white py-20 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal y={28}>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-16">
            <div>
              <h2
                className="font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.6rem,3.5vw,2.5rem)" }}
              >
                We view each project as infrastructure, not a transaction.
              </h2>
            </div>
            <div className="space-y-6 text-[#111827]/65 leading-relaxed">
              <p>
                The solar systems we install will generate clean power for
                25 years or more. The decisions made during design, procurement
                and installation — component quality, structural integrity,
                protection coordination — determine whether that 25-year promise
                is kept or quietly broken within the first decade.
              </p>
              <p>
                We engineer projects as long-term energy infrastructure, not as
                short-cycle installations optimised for installation day metrics.
                Every commissioning test, every warranty decision, every
                procurement specification reflects that position.
              </p>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Commitment section */}
      <section className="bg-[#f7f9fc] py-20 md:py-24 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal y={28}>
          <div className="max-w-[900px]">
            <h2
              className="font-display text-[#0e2a63] font-semibold leading-[1.05]"
              style={{ fontSize: "clamp(1.6rem,3.5vw,2.5rem)" }}
            >
              Our commitment to India&rsquo;s clean energy future.
            </h2>
            <p className="mt-7 text-[#111827]/65 text-lg leading-relaxed">
              India&rsquo;s national renewable energy targets are ambitious, and
              meeting them requires execution at volume across every segment —
              residential, commercial, industrial and government. Grid Nova
              Energy positions itself as the delivery partner that can execute
              at that volume without compromising on the engineering standards
              that determine whether those targets translate to actual, sustained
              clean generation.
            </p>
            <p className="mt-5 text-[#111827]/65 leading-relaxed">
              We do not view sustainability as a communications exercise. We view
              it as the primary measure of whether a solar installation was worth
              building in the first place.
            </p>
            <Link
              href="/projects"
              className="mt-10 inline-flex items-center gap-2 text-[#0e2a63] font-utility font-semibold text-sm group active:scale-[0.97] transition-transform"
            >
              See our project track record
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
