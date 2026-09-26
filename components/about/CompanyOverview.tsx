import Image from "next/image";
import overviewPhoto from "@/public/images/COMPANY OVERVIEW.webp";
import type { Messages } from "@/lib/i18n/types";

export default function CompanyOverview({ t }: { t: Messages["about"]["overview"] }) {
  const FACTS = t.facts;
  return (
    <section className="relative bg-white py-24 md:py-28 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-14 lg:gap-20">
          <div>
            <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
            <p className="mt-6 font-display text-[#0e2a63] text-2xl md:text-[28px] leading-[1.45] max-w-[62ch]">
              {/* Drop cap is a Latin typographic device; Devanagari/Bengali
                  conjuncts can't be split off a first letter, so translated
                  text sets `dropCap` to "" and renders as plain prose. */}
              {t.dropCap && (
                <span className="float-left font-display text-[clamp(2.5rem,10vw,5rem)] md:text-[80px] leading-[0.85] pr-3 pt-1 text-[#f7a800]">
                  {t.dropCap}
                </span>
              )}
              {t.lead}
            </p>
            <p className="mt-6 text-[#111827]/65 leading-relaxed max-w-[62ch]">
              {t.body}
            </p>
          </div>

          <div className="lg:pl-8 lg:border-l border-[#e4e8ee]">
            <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden mb-8">
              <Image
                src={overviewPhoto}
                alt={t.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 30vw"
                className="object-cover object-center"
              />
            </div>
            <p className="font-utility text-[11px] tracking-[0.15em] text-[#0e2a63]/50 uppercase mb-6">
              {t.glance}
            </p>
            <dl className="space-y-6">
              {FACTS.map((f) => (
                <div key={f.label} className="pb-6 border-b border-[#e4e8ee] last:border-0 last:pb-0">
                  <dt className="text-[#111827]/45 text-xs font-utility">
                    {f.label}
                  </dt>
                  <dd className="mt-1.5 font-display text-[#0e2a63] font-semibold text-lg">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
