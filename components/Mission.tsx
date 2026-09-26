import Image from "next/image";
import companyPhoto from "@/public/images/COMPANY PROFILE.webp";
import ScrollReveal from "@/components/ScrollReveal";
import type { Messages } from "@/lib/i18n/types";

// Mission + the former Sustainability band, merged: there are no documented
// impact figures beyond the install counts already shown in the Hero, so the
// sustainability point is one honest sentence here rather than its own section.
export default function Mission({ t }: { t: Messages["home"]["mission"] }) {
  return (
    <section className="relative bg-white py-24 md:py-32 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <ScrollReveal y={32}>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="relative aspect-[4/3] lg:aspect-[4/5] w-full rounded-2xl overflow-hidden">
              <Image
                src={companyPhoto}
                alt={t.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>

            <div>
              <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
              <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,7vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium text-balance">
                {t.title}
              </h2>
              <p className="mt-6 text-[#111827]/65 leading-relaxed max-w-[52ch]">{t.body}</p>
              <p className="mt-5 border-l-2 border-[#f7a800] pl-4 text-[#0e2a63] leading-relaxed max-w-[52ch]">
                {t.impact}
              </p>

              <dl className="mt-10 grid sm:grid-cols-2 gap-6 pt-8 border-t border-[#e4e8ee]">
                <div>
                  <dt className="font-utility text-[11px] tracking-[0.15em] text-[#002868] uppercase">{t.visionLabel}</dt>
                  <dd className="mt-2 text-[#111827]/70 text-sm leading-relaxed">{t.vision}</dd>
                </div>
                <div>
                  <dt className="font-utility text-[11px] tracking-[0.15em] text-[#7a5200] uppercase">{t.missionLabel}</dt>
                  <dd className="mt-2 text-[#111827]/70 text-sm leading-relaxed">{t.mission}</dd>
                </div>
              </dl>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
