import Image from "next/image";
import inverterPhoto from "@/public/images/Inverter Room.webp";

const CAPABILITIES = [
  "High-efficiency solar PV modules sourced from reputed, certified manufacturers.",
  "Advanced inverters and balance-of-system components meeting international benchmarks.",
  "System design optimized using industry-standard engineering software tools.",
  "Full compliance with MNRE guidelines, DISCOM interconnection requirements and safety standards.",
];

function DiamondMark() {
  return (
    <svg
      className="h-4 w-4 shrink-0 mt-1 fill-[#f7a800]"
      viewBox="0 0 12 16"
      aria-hidden="true"
    >
      <path d="M6 0L11 7.5 6 16 1 7.5z" />
    </svg>
  );
}

export default function TechnologyCapabilities() {
  return (
    <section className="relative bg-[#f7f9fc] py-24 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="ref-tag text-[#2f5daa]">Technology &amp; Capabilities</span>
            <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium max-w-[18ch] text-balance">
              Engineering standards, not shortcuts.
            </h2>
            <ul className="mt-9 space-y-5">
              {CAPABILITIES.map((c) => (
                <li key={c} className="flex gap-3.5">
                  <DiamondMark />
                  <span className="text-[#111827]/70 leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden">
            <Image
              src={inverterPhoto}
              alt="Inverter room and balance-of-system electrical equipment"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
