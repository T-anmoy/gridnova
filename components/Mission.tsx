import Image from "next/image";
import companyPhoto from "@/public/images/COMPANY PROFILE.webp";
import ScrollReveal from "@/components/ScrollReveal";

const VALUES = [
  "Sustainability",
  "Integrity",
  "Quality",
  "Innovation",
  "Customer Focus",
];

export default function Mission() {
  return (
    <section className="relative bg-white py-24 md:py-32 border-t border-[#e4e8ee]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <ScrollReveal y={32}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden lg:order-1">
            <Image
              src={companyPhoto}
              alt="Grid Nova Energy engineer inspecting rooftop solar installation"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>

          <div className="lg:order-2">
            <span className="ref-tag text-[#2f5daa]">Why We Exist</span>
            <h2 className="mt-4 font-display text-[#0e2a63] text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)] leading-[1.1] font-medium text-balance">
              Accelerating India&rsquo;s transition to clean, dependable
              power.
            </h2>
            <p className="mt-6 text-[#111827]/65 leading-relaxed max-w-[52ch]">
              Grid Nova Energy designs, develops and implements solar power
              systems for residential, commercial, industrial and
              institutional clients — combining technical expertise, quality
              engineering and a customer-centric approach to become a
              trusted, long-term partner in India&rsquo;s renewable energy
              ecosystem.
            </p>

            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              <div className="border-l-2 border-[#002868] pl-4">
                <p className="font-utility text-[11px] tracking-[0.15em] text-[#002868] uppercase">
                  Vision
                </p>
                <p className="mt-2 text-[#111827]/75 text-sm leading-relaxed">
                  To lead in innovative solar solutions that build energy
                  security and long-term value for clients and communities
                  across India.
                </p>
              </div>
              <div className="border-l-2 border-[#f7a800] pl-4">
                <p className="font-utility text-[11px] tracking-[0.15em] text-[#7a5200] uppercase">
                  Mission
                </p>
                <p className="mt-2 text-[#111827]/75 text-sm leading-relaxed">
                  Deliver efficient, affordable solar power that lowers
                  client costs and carbon footprint through proven
                  technology and engineering excellence.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {VALUES.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-[#f7f9fc] border border-[#e4e8ee] px-4 py-2 font-utility text-xs text-[#111827]/70"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
