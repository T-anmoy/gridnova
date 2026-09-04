import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import SolarCalculator from "./SolarCalculator";

export const metadata: Metadata = pageMetadata({
  title: "Solar Calculator — Instant Estimate",
  description:
    "Answer a few quick questions about your home or housing society and get an instant, indicative solar system estimate from Grid Nova Energy.",
  path: "/solar-calculator",
});

export default function SolarCalculatorPage() {
  return (
    <main className="bg-[#f7f9fc] min-h-[100svh]">
      <div className="mx-auto max-w-[900px] px-6 md:px-10 pt-[calc(var(--header-h)+3rem)] pb-20 md:pb-28">
        <div className="mb-12 md:mb-14 text-center">
          <span className="ref-tag text-[#2f5daa] justify-center">Solar Calculator</span>
          <h1
            className="mt-4 font-display text-[#0e2a63] font-medium leading-[0.95] text-balance mx-auto max-w-[22ch]"
            style={{ fontSize: "clamp(2rem,6vw,3.5rem)" }}
          >
            Get an Instant Solar Estimate
          </h1>
          <p className="mt-5 text-[#111827]/60 max-w-[54ch] mx-auto leading-relaxed text-base md:text-lg">
            Answer a few quick questions and see an indicative system cost right away —
            then leave your details for a full estimate from our team.
          </p>
          <a
            href="https://wa.me/919874774440"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#0e2a63]/20 text-[#0e2a63] font-utility text-sm font-semibold px-6 py-3 hover:bg-[#0e2a63] hover:text-white hover:border-[#0e2a63] transition-colors duration-300 active:scale-[0.97]"
          >
            <MessageCircle className="h-4 w-4" />
            Speak to a Solar Advisor on WhatsApp
          </a>
        </div>

        <SolarCalculator />
      </div>
    </main>
  );
}
