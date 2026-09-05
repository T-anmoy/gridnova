import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import BookingContextSummary from "./BookingContextSummary";

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

        {/* Booking widget lands here in Phase 2 — placement-only checkpoint for now. */}
        <div className="bg-white rounded-2xl border border-[#e4e8ee] p-10 md:p-14 text-center min-h-[420px] flex flex-col items-center justify-center">
          <p className="font-display text-[#0e2a63] text-lg font-semibold">
            Booking widget coming in the next phase
          </p>
          <p className="mt-2 text-[#111827]/50 text-sm max-w-[42ch]">
            This page is wired and ready — the interactive date/time picker is built next.
          </p>
        </div>
      </div>
    </main>
  );
}
