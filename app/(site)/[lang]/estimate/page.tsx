import { MessageCircle } from "lucide-react";
import EstimateForm from "./EstimateForm";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = localizedMetadata("estimate", "/estimate");

export default async function EstimatePage({ params }: LangParams) {
  const t = messagesFor(await resolveLocale(params)).estimate;
  return (
    <main className="bg-[#f7f9fc] min-h-[100svh]">
      <div className="mx-auto max-w-[900px] px-6 md:px-10 pt-[calc(var(--header-h)+3rem)] pb-20 md:pb-28">
        <div className="mb-12 md:mb-14 text-center">
          <span className="ref-tag text-[#2f5daa] justify-center">{t.eyebrow}</span>
          <h1
            className="mt-4 font-display text-[#0e2a63] font-medium leading-[0.95] text-balance mx-auto max-w-[20ch]"
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

        <EstimateForm t={t.form} />
      </div>
    </main>
  );
}
