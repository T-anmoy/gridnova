import Image, { type StaticImageData } from "next/image";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "@/components/i18n/Link";
import type { Messages } from "@/lib/i18n/types";
import residentialPhoto from "@/public/images/RESIDENTIAL.webp";
import commercialPhoto from "@/public/images/COMMERCIAL.webp";
import industrialPhoto from "@/public/images/INDUSTRIAL.webp";
import governmentPhoto from "@/public/images/STREET LIGHTING.webp";

// Four photo panels. A proof line appears only where a documented figure
// exists — Commercial has none on record, so it carries none.
const PHOTOS: Record<string, StaticImageData> = {
  residential: residentialPhoto,
  commercial: commercialPhoto,
  industrial: industrialPhoto,
  government: governmentPhoto,
};

export default function TargetMarkets({ t }: { t: Messages["home"]["markets"] }) {
  return (
    <section className="on-dark relative bg-[#091c3c] py-24 md:py-32 overflow-hidden">
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#2f5daa]/20 blur-[120px]" />
      <div className="relative mx-auto max-w-[1280px] px-6 md:px-10">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <span className="ref-tag text-[#f7a800]">{t.eyebrow}</span>
              <h2 className="mt-4 font-display text-white text-[clamp(1.4rem,7vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[22ch] text-balance">
                {t.title}
              </h2>
            </div>
            <Link href="/industries" className="btn-text w-fit">
              {t.link} →
            </Link>
          </div>
        </ScrollReveal>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {t.panels.map((panel, i) => (
            <ScrollReveal key={panel.id} delay={i * 0.08} className="h-full">
              <article className="group relative h-full min-h-[360px] md:min-h-[420px] rounded-2xl overflow-hidden flex flex-col justify-end">
                <Image
                  src={PHOTOS[panel.id]}
                  alt={panel.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#091c3c] via-[#091c3c]/60 to-transparent" />
                <div className="relative p-6">
                  {panel.proof && (
                    <p className="font-utility text-sm font-semibold text-[#f7a800]">{panel.proof}</p>
                  )}
                  <h3 className="mt-1.5 font-display text-white text-xl font-semibold">{panel.title}</h3>
                  <p className="mt-2 text-white/75 text-sm leading-relaxed">{panel.copy}</p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
