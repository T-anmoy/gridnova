import type { StaticImageData } from "next/image";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { fmt, type Messages } from "@/lib/i18n/types";
import ScrollReveal from "@/components/ScrollReveal";
import Image from "next/image";
import CTASection from "@/components/CTASection";
import michaelGomes from "@/public/leadership/michael-gomes.webp";
import shouvikBiswas from "@/public/leadership/shouvik-biswas.webp";
import rajaPaul from "@/public/leadership/raju-paul.webp";
import srinjayDas from "@/public/leadership/srinjay-das.webp";
import moloyDas from "@/public/leadership/moloy-das.webp";
import arunKumar from "@/public/leadership/arun-kumar.webp";
import narenMukherjee from "@/public/leadership/naren-mukherjee.webp";

type Leader = {
  key: keyof Messages["leaders"];
  name: string;
  initials: string;
  photo: StaticImageData;
};

export const generateMetadata = localizedMetadata("leadership", "/leadership");

// Names stay as written in every language; roles, bios and tags come from
// messages (leaders.<key>) so the homepage preview and this page share them.
const LEADERS: Leader[] = [
  { key: "michael-gomes", name: "Michael Gomes", initials: "MG", photo: michaelGomes },
  { key: "shouvik-biswas", name: "Shouvik Biswas", initials: "SB", photo: shouvikBiswas },
  { key: "raju-paul", name: "Raju Paul", initials: "RP", photo: rajaPaul },
  { key: "srinjay-das", name: "Srinjay Das", initials: "SD", photo: srinjayDas },
  { key: "moloy-das", name: "Moloy Das", initials: "MD", photo: moloyDas },
  { key: "arun-kumar", name: "Arun Kumar", initials: "AK", photo: arunKumar },
  { key: "naren-mukherjee", name: "Naren Mukherjee", initials: "NM", photo: narenMukherjee },
];

export default async function LeadershipPage({ params }: LangParams) {
  const m = messagesFor(await resolveLocale(params));
  const t = m.leadershipPage;
  return (
    <main>
      {/* Header — editorial, not a grid of avatar cards */}
      <section className="bg-[#f7f9fc] pt-[calc(var(--header-h)+3rem)] pb-0 border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 pb-12">
          <h1
            className="font-display text-[#0e2a63] font-medium leading-[0.95] text-balance max-w-[16ch]"
            style={{ fontSize: "clamp(2.4rem,7vw,5.5rem)" }}
          >
            {t.title}
          </h1>
          <p className="mt-8 text-[#111827]/60 max-w-[54ch] leading-relaxed text-lg">
            {t.intro}
          </p>
        </div>
      </section>

      {/* Leader profiles — alternating image placement, each bio in full */}
      {LEADERS.map((leader, idx) => {
        const isEven = idx % 2 === 0;
        const info: { role: string; bio: string; tags?: string[] } = m.leaders[leader.key];
        return (
          <section
            key={leader.name}
            className={`py-16 md:py-24 border-b border-[#e4e8ee] ${isEven ? "bg-white" : "bg-[#f7f9fc]"}`}
          >
            <div className="mx-auto max-w-[1280px] px-6 md:px-10">
              <ScrollReveal delay={0.05} x={isEven ? -16 : 16}>
          <div className={`grid gap-12 lg:gap-20 items-start ${isEven ? "lg:grid-cols-[0.65fr_1fr]" : "lg:grid-cols-[1fr_0.65fr]"}`}>
                <div className={isEven ? "" : "lg:order-2"}>
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden">
                    <Image
                      src={leader.photo}
                      alt={fmt(t.photoAlt, { name: leader.name, role: info.role })}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover object-center"
                    />
                  </div>
                </div>
                <div className={`pt-2 ${isEven ? "" : "lg:order-1"}`}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#0e2a63] to-[#2f5daa] flex items-center justify-center text-white font-display text-sm font-semibold shrink-0">
                      {leader.initials}
                    </div>
                    <div>
                      <h2 className="font-display text-[#0e2a63] text-2xl font-semibold">{leader.name}</h2>
                      <p className="text-[#2f5daa] font-utility text-sm mt-0.5">{info.role}</p>
                    </div>
                  </div>
                  <div className="h-px w-full bg-[#e4e8ee] mb-7" />
                  <p className="text-[#111827]/70 leading-relaxed text-base md:text-lg">
                    {info.bio}
                  </p>
                  {info.tags && info.tags.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {info.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#f7f9fc] border border-[#e4e8ee] px-4 py-2 font-utility text-xs text-[#111827]/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </ScrollReveal>
            </div>
          </section>
        );
      })}

      <CTASection t={m.cta} />
    </main>
  );
}
