import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import MagneticButton from "./MagneticButton";
import ScrollReveal from "@/components/ScrollReveal";

export default function CTASection() {
  return (
    <section className="relative isolate bg-[#0e2a63] py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 blueprint-grid-dark opacity-30" />
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 h-80 w-[70%] rounded-full bg-[#f7a800]/15 blur-[140px]" />
      <ScrollReveal y={28}>
      <div className="relative mx-auto max-w-[900px] px-6 text-center">
        <span className="ref-tag text-[#f7a800] justify-center">Let&rsquo;s Build</span>
        <h2
          className="mt-5 font-display text-white leading-[1.05] font-medium text-balance text-[clamp(1.4rem,8vw,2.5rem)] xs:text-[clamp(1.5rem,6.5vw,2.5rem)] md:text-[clamp(1.75rem,2.6vw,3rem)]"
        >
          Ready to engineer your energy future?
        </h2>
        <p className="mt-6 text-white/60 max-w-[46ch] mx-auto leading-relaxed">
          Talk to our engineering team about feasibility, system design and
          full DISCOM support — from first site visit to commissioning.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <MagneticButton>
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2 rounded-full bg-[#f7a800] text-[#091c3c] font-utility font-semibold text-sm px-6 py-3.5 hover:bg-white transition-colors duration-300 active:scale-[0.97]"
            >
              Request a Consultation
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </MagneticButton>
          <Link
            href="/book-a-call"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white font-utility text-sm px-6 py-3.5 hover:bg-white/10 hover:border-white/40 transition-colors duration-300 active:scale-[0.97]"
          >
            Book a Call
          </Link>
        </div>
        <a
          href="tel:+919874774440"
          className="mt-6 inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 font-utility text-xs transition-colors duration-300"
        >
          <Phone className="h-3 w-3" />
          Or call +91 98747 74440 directly
        </a>
      </div>
      </ScrollReveal>
    </section>
  );
}
