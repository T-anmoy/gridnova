"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { Messages } from "./types";

// Client-side access to the current locale and to the message namespaces the
// server chose to send. The site layout provides the shared chrome namespaces;
// a page adds only the namespaces its own client components need (via a
// nested I18nProvider), so each HTML page carries just the text it renders.

type Ctx = { locale: Locale; messages: Partial<Messages> };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale?: Locale;
  messages: Partial<Messages>;
  children: React.ReactNode;
}) {
  const parent = useContext(I18nContext);
  const value = useMemo<Ctx>(
    () => ({
      locale: locale ?? parent?.locale ?? DEFAULT_LOCALE,
      messages: { ...parent?.messages, ...messages },
    }),
    [locale, messages, parent],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Current locale. Outside any provider (internal tools) this is English. */
export function useLocale(): Locale {
  return useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;
}

/**
 * One message namespace. Throws if no provider above supplied it — a missing
 * namespace is a wiring bug, and falling back to English silently would hide it.
 */
export function useMessages<K extends keyof Messages>(namespace: K): Messages[K] {
  const ctx = useContext(I18nContext);
  const ns = ctx?.messages[namespace];
  if (!ns) {
    throw new Error(`i18n: message namespace "${String(namespace)}" was not provided`);
  }
  return ns as Messages[K];
}
