import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";
import type { Locale } from "./config";
import type { Messages } from "./types";

// Server-side only by convention (imported from layouts, pages and Server
// Components) — client components receive namespaces through I18nProvider.
// hi.json and bn.json are checked against en.json's shape by
// tests/unit/i18n-messages.test.ts, so they can be treated as `Messages`.
const ALL: Record<Locale, Messages> = {
  en,
  hi: hi as unknown as Messages,
  bn: bn as unknown as Messages,
};

export function messagesFor(locale: Locale): Messages {
  return ALL[locale];
}

// Namespaces used by the shared chrome (Navigation, Footer, Ask Nova, the
// language switcher). Every public page gets these; page-specific namespaces
// are added by the page itself.
const CHROME = ["common", "nav", "footer", "nova", "draftNotice", "notFound"] as const;

export function chromeMessages(m: Messages): Pick<Messages, (typeof CHROME)[number]> {
  return Object.fromEntries(CHROME.map((k) => [k, m[k]])) as Pick<Messages, (typeof CHROME)[number]>;
}

/** True while a locale's file is still an unreviewed machine draft. */
export function isMachineDraft(m: Messages): boolean {
  return (m as { _review_status?: string })._review_status === "machine-draft";
}
