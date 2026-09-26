import Image, { type StaticImageData } from "next/image";
import { ArrowUpRight } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import CountUp from "@/components/CountUp";
import Link from "@/components/i18n/Link";
import type { Messages } from "@/lib/i18n/types";
import showaPhoto from "@/public/images/1.3 MWp SHOWA INDIA.webp";
import pumpsPhoto from "@/public/images/PM KUSUM.webp";
import schoolsPhoto from "@/public/images/WBREDA SCHOOLS.webp";
import streetPhoto from "@/public/images/STREET LIGHTING.webp";

// Four real projects, each linking to its own section of /projects.
const PHOTOS: Record<string, StaticImageData> = {
  showa: showaPhoto,
  agricultural: pumpsPhoto,
  institutional: schoolsPhoto,
  "street-lighting": streetPhoto,
};

export default function ProjectStrip({
  t,
  districts,
}: {
  t: Messages["home"]["projects"];
  districts: string[];
}) {
  return (
    <section className="relative bg-[#f7f9fc] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
              <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,7vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[20ch] text-balance">
                {t.title}
              </h2>
            </div>
            <Link href="/projects" className="btn btn-secondary w-fit">
              {t.link}
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {t.items.map((item, i) => (
            <ScrollReveal key={item.id} delay={i * 0.08} className="h-full">
              <Link
                href={`/projects#${item.id}`}
                className="group flex flex-col h-full rounded-2xl overflow-hidden border border-[#e4e8ee] bg-white hover:border-[#2f5daa]/40 transition-colors duration-300"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={PHOTOS[item.id]}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="font-display text-[#0e2a63] text-3xl font-bold">
                    <CountUp value={item.stat} />
                  </div>
                  <h3 className="mt-2 font-display text-[#0e2a63] font-semibold">{item.title}</h3>
                  <p className="mt-1 text-[#111827]/55 text-sm font-utility flex-1">{item.place}</p>
                  <ArrowUpRight className="mt-4 h-4 w-4 text-[#0e2a63]/40 group-hover:text-[#f7a800] transition-colors duration-300" aria-hidden="true" />
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.15}>
          <p className="mt-8 text-[#111827]/55 text-sm leading-relaxed">
            <span className="font-utility font-semibold text-[#0e2a63]">{t.districtsLabel}:</span>{" "}
            {districts.join(" · ")}
          </p>
          <p className="mt-2 text-[#111827]/40 text-xs font-utility">{t.footnote}</p>
        </ScrollReveal>
      </div>
    </section>
  );
}
