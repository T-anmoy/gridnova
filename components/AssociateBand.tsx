import { Check } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import MagneticButton from "@/components/MagneticButton";
import Link from "@/components/i18n/Link";
import type { Messages } from "@/lib/i18n/types";

// Short pitch for the Associate Network, pointing to the full programme on
// /careers#associates. Every point is a term from the Associate Network
// Terms draft — nothing about earnings amounts, which live in the portal.
export default function AssociateBand({ t }: { t: Messages["home"]["associate"] }) {
  return (
    // Warm light band: it sits between the white leadership section and the
    // navy CTA, so it mustn't read as a second navy block.
    <section className="relative bg-[#fff7e0] border-y border-[#f7a800]/25 py-20 md:py-24 overflow-hidden">
      <div className="absolute inset-0 blueprint-grid-dark opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1280px] px-6 md:px-10">
        <ScrollReveal>
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center">
            <div>
              <span className="ref-tag text-[#7a5200]">{t.eyebrow}</span>
              <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,6.5vw,2.25rem)] md:text-[clamp(1.6rem,2.4vw,2.75rem)] leading-[1.12] font-medium text-balance">
                {t.title}
              </h2>
              <p className="mt-5 text-[#111827]/70 leading-relaxed max-w-[52ch]">{t.body}</p>
            </div>
            <div>
              <ul className="space-y-3">
                {t.points.map((point) => (
                  <li key={point} className="flex gap-3 items-start text-[#0e2a63]">
                    <Check className="h-5 w-5 shrink-0 mt-0.5 text-[#b8790a]" aria-hidden="true" />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <MagneticButton>
                  <Link href="/careers#associates" className="btn btn-primary">
                    {t.cta}
                  </Link>
                </MagneticButton>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
