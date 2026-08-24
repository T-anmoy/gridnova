import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import { pageMetadata } from "@/lib/seo";
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
  name: string;
  role: string;
  initials: string;
  photo: StaticImageData;
  bio: string;
  tags?: string[];
};

export const metadata: Metadata = pageMetadata({
  title: "Leadership",
  description:
    "Meet the Grid Nova Energy leadership team — decades of EPC experience, project management and renewable energy expertise.",
  path: "/leadership",
});

const LEADERS: Leader[] = [
  {
    name: "Michael Gomes",
    role: "Managing Partner",
    initials: "MG",
    photo: michaelGomes,
    bio: "Michael Gomes is an accomplished, dynamic serial entrepreneur and strong visionary with out-of-the-box thinking and a passion for building impactful businesses. A proven go-getter and inspirational leader, he is building a diversified conglomerate and has successfully led large-scale EPC businesses with year-on-year substantial growth. He brings together deep experience across marketing leadership, international relations, digital business, trade, and EPC project execution.",
  },
  {
    name: "Shouvik Biswas",
    role: "Partner",
    initials: "SB",
    photo: shouvikBiswas,
    bio: "As Partner at GRID NOVA ENERGY, Shouvik Biswas focuses on strategy, finance and growth, bringing a disciplined commercial and investment perspective to the company. He works closely with the leadership team on capital allocation, project evaluation, financial controls, strategic partnerships and expansion into new markets. His focus is on developing GRID NOVA ENERGY as a professionally managed, financially disciplined and scalable renewable-energy enterprise with strong foundations for long-term growth.",
  },
  {
    name: "Raju Paul",
    role: "Partner",
    initials: "RP",
    photo: rajaPaul,
    bio: "Mr. Raju Paul is a business strategist with over 25 years of experience translating market insight into structured, executable growth plans — a career that has evolved from strategic marketing into full-spectrum business strategy formation. A certified project management specialist with an advanced credential from IIT Roorkee, and an MBA and MSc in Economics from IIM Calcutta, he pairs rigorous analytical grounding with hands-on delivery discipline. As Grid Nova Energy's business growth strategist, Mr. Paul works closely with the leadership team to align commercial ambition with operational execution, steering expansion into new markets and segments through the same disciplined, results-driven approach that has defined his career.",
    tags: ["25+ Years Experience", "Project Management Specialist", "Business Growth Strategist"],
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
  {
    name: "Naren Mukherjee",
    role: "Senior Advisor — Solar Power",
    initials: "NM",
    photo: narenMukherjee,
    bio: "Mr. Naren Mukherjee brings 30 years of Information Technology experience across hardware, software and customer engineering support, most recently as Eastern Regional Support Head at Spice Net Ltd. An Electrical Engineer by profession, he steered PCL to India's first ISO 9002 certification for IT support services, and was recognised as Intel Corporation's Best IT Professional of Asia in 1998. Since 2009, he has brought that same engineering discipline to solar power, supervising the installation of more than 25 MWp of solar capacity across India.",
    tags: ["30+ Years Experience", "25+ MWp Solar Delivered", "Electrical Engineer"],
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
                  {leader.tags && leader.tags.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {leader.tags.map((tag) => (
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

      <CTASection />
    </main>
  );
}
