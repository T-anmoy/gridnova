import Image, { type StaticImageData } from "next/image";
import { ArrowUpRight } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "@/components/i18n/Link";
import type { Messages } from "@/lib/i18n/types";
import michaelGomes from "@/public/leadership/michael-gomes.webp";
import shouvikBiswas from "@/public/leadership/shouvik-biswas.webp";
import rajuPaul from "@/public/leadership/raju-paul.webp";
import srinjayDas from "@/public/leadership/srinjay-das.webp";
import moloyDas from "@/public/leadership/moloy-das.webp";
import arunKumar from "@/public/leadership/arun-kumar.webp";
import narenMukherjee from "@/public/leadership/naren-mukherjee.webp";

// The same real photos /leadership uses. Names stay as written in every
// language; roles come from messages (leaders.<key>.role).
const LEADERS: { key: keyof Messages["leaders"]; name: string; photo: StaticImageData }[] = [
  { key: "michael-gomes", name: "Michael Gomes", photo: michaelGomes },
  { key: "shouvik-biswas", name: "Shouvik Biswas", photo: shouvikBiswas },
  { key: "raju-paul", name: "Raju Paul", photo: rajuPaul },
  { key: "srinjay-das", name: "Srinjay Das", photo: srinjayDas },
  { key: "moloy-das", name: "Moloy Das", photo: moloyDas },
  { key: "arun-kumar", name: "Arun Kumar", photo: arunKumar },
  { key: "naren-mukherjee", name: "Naren Mukherjee", photo: narenMukherjee },
];

export default function LeadershipPreview({
  t,
  leaders,
}: {
  t: Messages["home"]["leadership"];
  leaders: Messages["leaders"];
}) {
  return (
    <section className="relative bg-white py-24 md:py-32 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <span className="ref-tag text-[#2f5daa]">{t.eyebrow}</span>
              <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,7vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[18ch] text-balance">
                {t.title}
              </h2>
            </div>
            <Link href="/leadership" className="btn-text w-fit">
              {t.link} →
            </Link>
          </div>
        </ScrollReveal>

        {/* One column of compact rows until lg:, then one portrait card per
            leader in a single row of seven — no layout at any width can leave
            an empty slot. */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 lg:gap-4">
          {LEADERS.map((l, idx) => (
            <ScrollReveal key={l.key} delay={idx * 0.06}>
              <Link
                href="/leadership"
                className="group flex lg:flex-col items-center lg:items-stretch gap-4 lg:gap-0 h-full rounded-2xl lg:rounded-none p-2 lg:p-0 hover:bg-[#f7f9fc] lg:hover:bg-transparent transition-colors duration-300"
              >
                <div className="relative h-16 w-16 lg:h-auto lg:w-full lg:aspect-[4/5] shrink-0 rounded-xl overflow-hidden bg-[#e4e8ee]">
                  <Image
                    src={l.photo}
                    alt={`${l.name}, ${leaders[l.key].role}`}
                    fill
                    sizes="(max-width: 1024px) 64px, 170px"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="lg:mt-3">
                  <p className="font-display text-[#0e2a63] font-semibold text-[15px] leading-snug group-hover:text-[#2f5daa] transition-colors duration-300">
                    {l.name}
                  </p>
                  <p className="mt-0.5 text-[#111827]/55 text-xs font-utility leading-snug">
                    {leaders[l.key].role}
                  </p>
                </div>
                <ArrowUpRight className="lg:hidden ml-auto h-4 w-4 text-[#0e2a63]/30" aria-hidden="true" />
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
