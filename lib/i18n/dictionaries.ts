import type { Locale } from "./config";
import type { Messages } from "./types";

// Server-side only by convention (imported from layouts, pages and Server
// Components) — client components receive namespaces through I18nProvider.
// hi.json and bn.json are checked against en.json's shape by
// tests/unit/i18n-messages.test.ts, so they can be treated as `Messages`.
//
// Each locale is a separate dynamic import, so a request only loads (and a
// server bundle only has to carry per-request) the one file it needs instead
// of all three (~670 KB) up front.
const LOADERS: Record<Locale, () => Promise<Messages>> = {
  en: () => import("@/messages/en.json").then((m) => m.default),
  hi: () => import("@/messages/hi.json").then((m) => m.default as unknown as Messages),
  bn: () => import("@/messages/bn.json").then((m) => m.default as unknown as Messages),
};

const cache = new Map<Locale, Promise<Messages>>();

export function messagesFor(locale: Locale): Promise<Messages> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = LOADERS[locale]();
    cache.set(locale, pending);
  }
  return pending;
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
