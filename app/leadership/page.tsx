import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import ScrollReveal from "@/components/ScrollReveal";
import Image from "next/image";
import CTASection from "@/components/CTASection";
import michaelGomes from "@/public/leadership/michael-gomes.webp";
import rajaPaul from "@/public/leadership/raju-paul.webp";
import srinjayDas from "@/public/leadership/srinjay-das.webp";
import moloyDas from "@/public/leadership/moloy-das.webp";
import arunKumar from "@/public/leadership/arun-kumar.webp";

export const metadata: Metadata = pageMetadata({
  title: "Leadership",
  description:
    "Meet the Grid Nova Energy leadership team — decades of EPC experience, project management and renewable energy expertise.",
  path: "/leadership",
});

const LEADERS = [
  {
    name: "Michael Gomes",
    role: "Managing Partner",
    initials: "MG",
    photo: michaelGomes,
    bio: "Michael Gomes is an accomplished, dynamic serial entrepreneur and strong visionary with out-of-the-box thinking and a passion for building impactful businesses. A proven go-getter and inspirational leader, he is building a diversified conglomerate and has successfully led large-scale EPC businesses with year-on-year substantial growth. He brings together deep experience across marketing leadership, international relations, digital business, trade, and EPC project execution.",
  },
  {
    name: "Raju Paul",
    role: "Partner",
    initials: "RP",
    photo: rajaPaul,
    bio: "Raju Paul is a seasoned business professional with over 25 years of extensive experience in strategic marketing, business growth and organisational leadership. He holds an MSc in Economics (specialisation in International Business), an MBA, and is an alumnus of the Indian Institute of Management Kolkata (IIM-C), plus an advanced project management certification from IIT Roorkee.",
  },
  {
    name: "Srinjay Das",
    role: "Vice President, Business",
    initials: "SD",
    photo: srinjayDas,
    bio: "Srinjay Das is a veteran professional with strong analytical and technical abilities and 25+ years of experience in international business and managing key accounts. His competency in EPC, project management and construction management is a core organisational asset, backed by exceptional negotiation skills and deep knowledge of the Indian market.",
  },
  {
    name: "Moloy Das",
    role: "General Manager, Projects",
    initials: "MD",
    photo: moloyDas,
    bio: "A seasoned graduate engineer with 20 years of experience in planning and project management, Moloy Das has executed large-scale infrastructure, turnkey mechanical and solar energy projects across India — the operational backbone of Grid Nova's project delivery engine.",
  },
  {
    name: "Arun Kumar",
    role: "Zonal Sales Manager",
    initials: "AK",
    photo: arunKumar,
    bio: "Arun Kumar is a dynamic, results-oriented sales professional with over three decades of experience in the solar and renewable energy sector, with a proven record securing utility-scale, commercial, industrial and government solar EPC contracts across India.",
  },
];

export default function LeadershipPage() {
  return (
    <main>
      {/* Header — editorial, not a grid of avatar cards */}
      <section className="bg-[#f7f9fc] pt-[calc(var(--header-h)+3rem)] pb-0 border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 pb-12">
          <h1
            className="font-display text-[#0e2a63] font-medium leading-[0.95] text-balance max-w-[16ch]"
            style={{ fontSize: "clamp(2.4rem,7vw,5.5rem)" }}
          >
            The team behind the projects.
          </h1>
          <p className="mt-8 text-[#111827]/60 max-w-[54ch] leading-relaxed text-lg">
            Grid Nova Energy is led by professionals who have spent decades in
            EPC delivery, project management and renewable energy sales across
            India. These are the people accountable for every project we execute.
          </p>
        </div>
      </section>

      {/* Leader profiles — alternating image placement, each bio in full */}
      {LEADERS.map((leader, idx) => {
        const isEven = idx % 2 === 0;
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
                      alt={`${leader.name}, ${leader.role} at Grid Nova Energy`}
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
                      <p className="text-[#2f5daa] font-utility text-sm mt-0.5">{leader.role}</p>
                    </div>
                  </div>
                  <div className="h-px w-full bg-[#e4e8ee] mb-7" />
                  <p className="text-[#111827]/70 leading-relaxed text-base md:text-lg">
                    {leader.bio}
                  </p>
                </div>
              </div>
              </ScrollReveal>
            </div>
          </section>
        );
      })}

      <CTASection />
    </main>
  );
}
