import CountUp from "@/components/CountUp";
import Link from "@/components/i18n/Link";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

export const generateMetadata = localizedMetadata("sustainability", "/sustainability");

// Documented figures only; labels and notes come from messages.
const IMPACT_VALUES = ["4,800+", "330+", "2,350+", "1,200+"] as const;

export default async function SustainabilityPage({ params }: LangParams) {
  const t = messagesFor(await resolveLocale(params)).sustainabilityPage;
  const IMPACT = IMPACT_VALUES.map((value, i) => ({ value, ...t.impact[i] }));
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
            {t.quote}
          </h1>
          <p className="mt-10 text-white/80 max-w-[56ch] leading-relaxed text-lg">
            {t.intro}
          </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Impact metrics — documented numbers only, no invented CO₂ figures */}
      <section className="bg-[#091c3c] py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="mb-12">
            <p className="font-utility text-[11px] tracking-[0.22em] text-white/40 uppercase mb-4">{t.impactEyebrow}</p>
            <h2
              className="font-display text-white font-semibold leading-[1.05] max-w-[22ch] text-balance"
              style={{ fontSize: "clamp(1.6rem,3.5vw,2.5rem)" }}
            >
              {t.impactTitle}
            </h2>
            <p className="mt-5 text-white/50 max-w-[46ch] leading-relaxed text-sm">
              {t.impactBody}
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
            {t.footnote}
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
                {t.beliefTitle}
              </h2>
            </div>
            <div className="space-y-6 text-[#111827]/65 leading-relaxed">
              <p>{t.beliefBody}</p>
              <p>{t.beliefBody2}</p>
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
              {t.commitmentTitle}
            </h2>
            <p className="mt-7 text-[#111827]/65 text-lg leading-relaxed">
              {t.commitmentBody}
            </p>
            <p className="mt-5 text-[#111827]/65 leading-relaxed">
              {t.commitmentBody2}
            </p>
            <Link
              href="/projects"
              className="mt-10 inline-flex items-center gap-2 text-[#0e2a63] font-utility font-semibold text-sm group active:scale-[0.97] transition-transform"
            >
              {t.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
