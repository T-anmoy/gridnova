"use client";

import { useRouter } from "next/navigation";
import { useLocale, useMessages } from "@/lib/i18n/client";
import { LOCALES, LOCALE_META, localizeHref, type Locale } from "@/lib/i18n/config";
import { rememberLocale } from "@/lib/i18n/cookie";
import { useBarePathname } from "@/lib/i18n/navigation";

/**
 * Switch language and stay on the same page. The choice is stored in a cookie
 * so the proxy can send the visitor to their language on later visits.
 * Labels are each language's own name (English / हिन्दी / বাংলা), never
 * translated, so a visitor can always find their language.
 */
export default function LanguageSwitcher({
  tone = "dark",
  size = "sm",
  /** Include the display utility (e.g. "hidden sm:inline-flex"); defaults to inline-flex. */
  className = "inline-flex",
  onSwitch,
}: {
  tone?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
  onSwitch?: () => void;
}) {
  const locale = useLocale();
  const t = useMessages("common");
  const barePath = useBarePathname();
  const router = useRouter();

  const choose = (next: Locale) => {
    if (next === locale) return;
    rememberLocale(next);
    const hash = window.location.hash;
    const search = window.location.search;
    onSwitch?.();
    router.push(localizeHref(barePath, next) + search + hash);
  };

  const base =
    tone === "dark"
      ? "text-white/65 hover:text-white"
      : "text-[#0e2a63]/60 hover:text-[#0e2a63]";
  const active = tone === "dark" ? "text-[#091c3c] bg-white" : "text-white bg-[#0e2a63]";
  const pad = size === "md" ? "px-3.5 py-2 text-sm" : "px-2.5 py-1 text-[12px]";

  return (
    <div
      role="group"
      aria-label={t.languageLabel}
      className={`items-center gap-0.5 rounded-full ${
        tone === "dark" ? "border border-white/20" : "border border-[#e4e8ee]"
      } p-0.5 ${className}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          aria-label={LOCALE_META[l].label}
          onClick={() => choose(l)}
          className={`rounded-full font-utility whitespace-nowrap transition-colors duration-200 ${pad} ${
            l === locale ? active : base
          }`}
        >
          {size === "md" ? LOCALE_META[l].label : LOCALE_META[l].short}
        </button>
      ))}
    </div>
  );
}
