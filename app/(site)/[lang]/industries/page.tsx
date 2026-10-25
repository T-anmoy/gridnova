import Image from "next/image";
import residentialPhoto from "@/public/images/RESIDENTIAL.webp";
import commercialPhoto from "@/public/images/COMMERCIAL.webp";
import industrialPhoto from "@/public/images/INDUSTRIAL.webp";
import CTASection from "@/components/CTASection";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "@/components/i18n/Link";
import { ArrowRight } from "lucide-react";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = localizedMetadata("industries", "/industries");

export default async function IndustriesPage({ params }: LangParams) {
  const m = (await messagesFor(await resolveLocale(params)));
  const t = m.industries;
  return (
    <main id="main-content">
      {/* No eyebrow, no hero formula — large typographic opener */}
      <section className="pt-[calc(var(--header-h)+3rem)] pb-12 bg-white border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal y={32}>
          <h1
            className="font-display text-[#0e2a63] font-medium leading-[0.95] text-balance"
            style={{ fontSize: "clamp(1.75rem,8vw,7rem)" }}
          >
            {t.title}
            <span className="block text-[#f7a800]">{t.titleAccent}</span>
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
                alt={t.residential.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-center"
              />
            </div>
            <div className="lg:order-1">
              <div className="inline-flex items-center gap-3 mb-8">
                <span className="h-px w-10 bg-[#f7a800]" />
                <span className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/65 uppercase">{t.residential.label}</span>
              </div>
              <h2
                className="font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                {t.residential.heading}
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed max-w-[52ch]">
                {t.residential.body}
              </p>
              <ul className="mt-8 space-y-3">
                {t.residential.points.map((i) => (
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
                alt={t.commercial.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-center"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-3 mb-8">
                <span className="h-px w-10 bg-[#f7a800]" />
                <span className="font-utility text-[11px] tracking-[0.22em] text-[#111827]/65 uppercase">{t.commercial.label}</span>
              </div>
              <h2
                className="font-display text-[#0e2a63] font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                {t.commercial.heading}
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed">
                {t.commercial.body}
              </p>
              <p className="mt-4 text-[#111827]/65 leading-relaxed">
                {t.commercial.body2}
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
                alt={t.industrial.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
            <div className="lg:order-1">
              <div className="inline-flex items-center gap-3 mb-8">
                <span className="h-px w-10 bg-[#f7a800]" />
                <span className="font-utility text-[11px] tracking-[0.22em] text-white/60 uppercase">{t.industrial.label}</span>
              </div>
              <h2
                className="font-display text-white font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                {t.industrial.heading}
              </h2>
              <p className="mt-6 text-white/60 leading-relaxed">
                {t.industrial.body}
              </p>
              <p className="mt-4 text-white/60 leading-relaxed">
                {t.industrial.body2}
              </p>
              <Link
                href="/projects"
                className="mt-8 inline-flex min-h-11 items-center gap-2 text-[#f7a800] font-utility text-sm font-semibold group active:scale-[0.97] transition-transform"
              >
                {t.industrial.link}
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
            <span className="font-utility text-[11px] tracking-[0.22em] text-white/60 uppercase">{t.government.label}</span>
          </div>
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-20 items-end">
            <div>
              <h2
                className="font-display text-white font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)" }}
              >
                {t.government.heading}
              </h2>
              <p className="mt-6 text-white/60 leading-relaxed">
                {t.government.body}
              </p>
              <p className="mt-6 text-white/60 text-xs font-utility leading-relaxed max-w-[52ch]">
                {t.government.footnote}
              </p>
            </div>
            <div className="lg:text-right space-y-8">
              {t.government.stats.map(({ n, l }) => (
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

      <CTASection t={m.cta} />
    </main>
  );
}
