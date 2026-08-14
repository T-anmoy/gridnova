import Image from "next/image";
import showaPhoto from "@/public/images/1.3 MWp SHOWA INDIA.webp";
import { MapPin, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";

const DISTRICTS = [
  "Patna", "Jehanabad", "Purnia", "Katihar", "Nawada", "Seohar",
  "Hooghly", "Burdwan", "Malda", "Midnapore", "Barasat", "Kolkata",
];

export default function FeaturedProject() {
  return (
    <section className="relative bg-[#f7f9fc] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <ScrollReveal>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-14 md:mb-16">
          <div>
            <span className="ref-tag text-[#2f5daa]">Industrial Reference</span>
            <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[20ch] text-balance">
              Proof of execution at scale.
            </h2>
          </div>
        </div>

        </ScrollReveal>
        <ScrollReveal delay={0.1}>
        <div className="grid lg:grid-cols-[1fr_0.85fr] gap-8 items-stretch">
          <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden">
            <Image
              src={showaPhoto}
              alt="1.3 MWp industrial rooftop solar array, Showa India, Faridabad"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover object-center"
            />
          </div>

          <div className="rounded-2xl border border-[#e4e8ee] bg-white p-7 md:p-9 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-[#0e2a63] text-2xl md:text-3xl font-semibold">
                1.3 MWp Solar EPC
              </h3>
              <p className="mt-1.5 text-[#111827]/55 font-utility text-sm flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Showa India, Faridabad
              </p>
              <p className="mt-5 text-[#111827]/65 leading-relaxed">
                A full-scale industrial solar EPC project delivered by Grid
                Nova&rsquo;s team and branch network — from design and
                procurement through construction and commissioning — on a large,
                performance-critical installation.
              </p>
            </div>
            <Link
              href="/projects"
              className="mt-8 inline-flex items-center gap-1.5 text-[#0e2a63] font-utility text-sm font-semibold group w-fit"
            >
              View full project index
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Link>
          </div>
        </div>

        </ScrollReveal>
        <ScrollReveal delay={0.18}>
        <div className="mt-8 rounded-2xl border border-[#e4e8ee] bg-white p-7 md:p-9">
          <p className="font-utility text-[11px] tracking-[0.15em] text-[#2f5daa]/70 uppercase mb-4">
            Districts Covered — West Bengal &amp; Bihar
          </p>
          <div className="flex flex-wrap gap-2.5">
            {DISTRICTS.map((d) => (
              <span
                key={d}
                className="rounded-full bg-[#f7f9fc] border border-[#e4e8ee] px-3.5 py-1.5 text-[#111827]/70 text-xs font-utility"
              >
                {d}
              </span>
            ))}
            <span className="rounded-full px-3.5 py-1.5 text-[#2f5daa] text-xs font-utility">
              + more
            </span>
          </div>
        </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
