import { MessageCircle, Phone } from "lucide-react";
import BookingContextSummary from "./BookingContextSummary";
import BookingWidget from "./BookingWidget";
import { I18nProvider } from "@/lib/i18n/client";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = localizedMetadata("booking", "/book-a-call");

export default async function BookACallPage({
  params,
  searchParams,
}: LangParams & {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const asString = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const m = (await messagesFor(await resolveLocale(params)));
  const t = m.bookingPage;

  return (
    <main id="main-content" className="bg-[#f7f9fc] min-h-[100svh]">
      <div className="mx-auto max-w-[900px] px-6 md:px-10 pt-[calc(var(--header-h)+3rem)] pb-20 md:pb-28">
        <div className="mb-12 md:mb-14 text-center">
          <span className="ref-tag text-[#2f5daa] justify-center">{t.eyebrow}</span>
          <h1
            className="mt-4 font-display text-[#0e2a63] font-medium leading-[0.95] text-balance mx-auto max-w-[22ch]"
            style={{ fontSize: "clamp(2rem,6vw,3.5rem)" }}
          >
            {t.title}
          </h1>
          <p className="mt-5 text-[#111827]/60 max-w-[54ch] mx-auto leading-relaxed text-base md:text-lg">
            {t.intro}
          </p>
          <a
            href="https://wa.me/919874774440"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary mt-6"
          >
            <MessageCircle className="h-4 w-4" />
            {t.whatsapp}
          </a>
        </div>

        <BookingContextSummary
          estimatedTotal={asString(query.estimatedTotal)}
          sizingMethod={asString(query.sizingMethod)}
          sizingValue={asString(query.sizingValue)}
          source={asString(query.source)}
          t={m.booking.summary}
        />

        <I18nProvider messages={{ booking: m.booking }}>
          <BookingWidget
            estimatedTotal={asString(query.estimatedTotal)}
            sizingMethod={asString(query.sizingMethod)}
            sizingValue={asString(query.sizingValue)}
            source={asString(query.source)}
          />
        </I18nProvider>

        <div className="mt-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-[#e4e8ee]" />
          <p className="font-utility text-xs text-[#111827]/65 uppercase tracking-wider">
            {t.talkNow}
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
          <p className="mt-3 text-[#111827]/65 text-sm">
            {t.hours}
          </p>
        </div>
      </div>
    </main>
  );
}
