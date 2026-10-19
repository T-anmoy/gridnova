import Image from "next/image";
import companyPhoto from "@/public/images/COMPANY PROFILE.webp";
import type { Messages } from "@/lib/i18n/types";

// The reveal is pure CSS (.ah-reveal in globals.css, staggered by --i), so the
// first frame already matches the server markup. The hero photo — the LCP
// element — is not animated at all.
const step = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function AboutHero({ t }: { t: Messages["about"]["hero"] }) {
  return (
    <section
      className="relative bg-[#f7f9fc] pt-[calc(var(--header-h)+2.5rem)] pb-20 md:pb-28 blueprint-grid"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-end">
          <div>
            <span style={step(0)} className="ah-reveal ref-tag text-[#2f5daa]">
              {t.eyebrow}
            </span>
            <h1 style={step(1)} className="ah-reveal mt-6 font-display text-[#0e2a63] text-[clamp(2rem,11vw,3.5rem)] xs:text-[clamp(2.1rem,9vw,3.5rem)] md:text-[clamp(2.5rem,4.6vw,5.5rem)] leading-[1.0] font-medium text-balance">
              {t.title}
              <span className="text-[#f7a800]"> {t.titleAccent}</span>
            </h1>
            <p style={step(2)} className="ah-reveal mt-7 max-w-[54ch] text-[#111827]/65 leading-relaxed text-base md:text-lg">
              {t.body}
            </p>
          </div>
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
            <Image
              src={companyPhoto}
              alt={t.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
