import { ArrowRight, Phone } from "lucide-react";
import Link from "@/components/i18n/Link";
import MagneticButton from "./MagneticButton";
import ScrollReveal from "@/components/ScrollReveal";
import type { Messages } from "@/lib/i18n/types";
import { HELPLINE_TEL } from "@/lib/contact";

export default function CTASection({ t }: { t: Messages["cta"] }) {
  return (
    <section className="on-dark relative isolate bg-[#0e2a63] py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 blueprint-grid-dark opacity-30" />
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 h-80 w-[70%] rounded-full bg-[#f7a800]/15 blur-[140px]" />
      <ScrollReveal y={28}>
      <div className="relative mx-auto max-w-[900px] px-6 text-center">
        <span className="ref-tag text-[#f7a800] justify-center">{t.eyebrow}</span>
        <h2
          className="mt-5 font-display text-white leading-[1.05] font-medium text-balance text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)]"
        >
          {t.title}
        </h2>
        <p className="mt-6 text-white/60 max-w-[46ch] mx-auto leading-relaxed">
          {t.body}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <MagneticButton>
            <Link
              href="/contact"
              className="group btn btn-primary"
            >
              {t.primary}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </MagneticButton>
          <Link
            href="/book-a-call"
            className="btn btn-secondary"
          >
            {t.secondary}
          </Link>
        </div>
        <a
          href={HELPLINE_TEL}
          className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-white/60 hover:text-white/70 font-utility text-xs transition-colors duration-300"
        >
          <Phone className="h-3 w-3" />
          {t.call}
        </a>
      </div>
      </ScrollReveal>
    </section>
  );
}
