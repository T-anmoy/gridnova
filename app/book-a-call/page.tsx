import type { Metadata } from "next";
import { MessageCircle, Phone } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import BookingContextSummary from "./BookingContextSummary";
import BookingWidget from "./BookingWidget";

export const metadata: Metadata = pageMetadata({
  title: "Book a Call",
  description:
    "Talk to a Grid Nova Energy Solar Advisor — 30 minutes, no pressure. Pick a time that works and we'll call you.",
  path: "/book-a-call",
});

export default async function BookACallPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const asString = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return (
    <main className="bg-[#f7f9fc] min-h-[100svh]">
      <div className="mx-auto max-w-[900px] px-6 md:px-10 pt-[calc(var(--header-h)+3rem)] pb-20 md:pb-28">
        <div className="mb-12 md:mb-14 text-center">
          <span className="ref-tag text-[#2f5daa] justify-center">Book a Call</span>
          <h1
            className="mt-4 font-display text-[#0e2a63] font-medium leading-[0.95] text-balance mx-auto max-w-[22ch]"
            style={{ fontSize: "clamp(2rem,6vw,3.5rem)" }}
          >
            Talk to a Solar Advisor
          </h1>
          <p className="mt-5 text-[#111827]/60 max-w-[54ch] mx-auto leading-relaxed text-base md:text-lg">
            30 minutes, no pressure. Pick a time that works and we&rsquo;ll call you.
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

        <BookingContextSummary
          estimatedTotal={asString(params.estimatedTotal)}
          sizingMethod={asString(params.sizingMethod)}
          sizingValue={asString(params.sizingValue)}
          source={asString(params.source)}
        />

        <BookingWidget
          estimatedTotal={asString(params.estimatedTotal)}
          sizingMethod={asString(params.sizingMethod)}
          sizingValue={asString(params.sizingValue)}
          source={asString(params.source)}
        />

        <div className="mt-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-[#e4e8ee]" />
          <p className="font-utility text-xs text-[#111827]/40 uppercase tracking-wider">
            Prefer to talk right now?
          </p>
          <div className="h-px flex-1 bg-[#e4e8ee]" />
        </div>

        <div className="mt-8 rounded-2xl border border-[#e4e8ee] bg-white p-8 md:p-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f7a800]/10">
            <Phone className="h-5 w-5 text-[#f7a800]" />
          </div>
          <a
            href="tel:+919874774440"
            className="mt-5 inline-flex items-center gap-2.5 font-display text-[#0e2a63] font-bold hover:text-[#2f5daa] transition-colors duration-300 active:scale-[0.97]"
            style={{ fontSize: "clamp(1.6rem,5vw,2.25rem)" }}
          >
            +91 98747 74440
          </a>
          <p className="mt-3 text-[#111827]/50 text-sm">
            Mon&ndash;Sat, 9am&ndash;7pm IST &mdash; no form, no waiting.
          </p>
        </div>
      </div>
    </main>
  );
}
