import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = pageMetadata({
  title: "Careers",
  description:
    "Join Grid Nova Energy — a team of engineers, project managers and solar professionals building India's clean energy future.",
  path: "/careers",
});

const VALUES = [
  { label: "Engineering integrity", desc: "We don't cut corners on specs, procurement or commissioning." },
  { label: "Long-term thinking", desc: "We measure success in decades of performance, not the delivery day." },
  { label: "Customer accountability", desc: "Every team member is a direct point of contact for the client." },
  { label: "Continuous learning", desc: "Solar EPC evolves rapidly. Curiosity is a requirement, not a bonus." },
];

export default function CareersPage() {
  return (
    <main>
      {/* Intro — no eyebrow, no formula */}
      <section className="pt-[calc(var(--header-h)+4rem)] pb-20 md:pb-28 bg-white border-b border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal>
          <div className="max-w-[760px]">
            <h1
              className="font-display text-[#0e2a63] font-medium leading-[1.0] text-balance"
              style={{ fontSize: "clamp(2.4rem,8vw,5rem)" }}
            >
              Build the grid with us.
            </h1>
            <p className="mt-8 text-[#111827]/65 text-lg leading-relaxed max-w-[52ch]">
              Grid Nova Energy is a growing renewable energy company executing
              solar EPC projects across West Bengal and Bihar. We&rsquo;re
              looking for engineers, project managers and sales professionals
              who care about doing this right — not just fast.
            </p>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Who thrives here */}
      <section className="bg-[#f7f9fc] py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal y={28}>
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 items-start">
            <div>
              <h2 className="font-display text-[#0e2a63] text-2xl md:text-3xl font-semibold leading-snug">
                The kind of person who thrives here
              </h2>
              <p className="mt-5 text-[#111827]/60 leading-relaxed">
                You understand that solar EPC is infrastructure work — methodical,
                detail-intensive, and accountable across a 25-year system lifetime.
                You prefer getting it right over getting it done fast.
              </p>
              <p className="mt-4 text-[#111827]/60 leading-relaxed">
                You&rsquo;re comfortable in the field as much as in a spreadsheet.
                You know that DISCOM processes and MNRE compliance aren&rsquo;t
                bureaucratic nuisances — they&rsquo;re the job.
              </p>
            </div>
            <div className="space-y-6">
              {VALUES.map((v) => (
                <div key={v.label} className="flex gap-5 items-start">
                  <div className="mt-1 h-2 w-2 rounded-full bg-[#f7a800] shrink-0" />
                  <div>
                    <p className="font-display text-[#0e2a63] font-semibold">{v.label}</p>
                    <p className="mt-1 text-[#111827]/60 text-sm leading-relaxed">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Honest no-listings section */}
      <section className="bg-white py-20 md:py-28 border-t border-[#e4e8ee]">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10">
          <ScrollReveal y={28}>
          <div className="max-w-[640px]">
            <p className="font-utility text-[11px] tracking-[0.18em] text-[#111827]/40 uppercase mb-5">
              Current Openings
            </p>
            <h2 className="font-display text-[#0e2a63] text-2xl font-semibold">
              No roles listed right now.
            </h2>
            <p className="mt-5 text-[#111827]/60 leading-relaxed max-w-[50ch]">
              We hire when we find the right person for a specific need — not
              the other way around. If your background is in solar EPC, project
              management, electrical engineering or renewable energy sales, send
              us your CV and we&rsquo;ll reach out when something opens that fits.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="mailto:careers@gridnova.in?subject=Career%20Enquiry%20—%20Grid%20Nova%20Energy"
                className="group inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97]"
              >
                <Mail className="h-4 w-4" />
                Email Your CV
              </a>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-full border border-[#e4e8ee] text-[#0e2a63] font-utility text-sm px-6 py-3.5 hover:bg-[#f7f9fc] transition-colors duration-300 active:scale-[0.97]"
              >
                Learn About Us
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
