import en from "@/messages/en.json";
import { I18nProvider } from "@/lib/i18n/client";

// English messages, and a wrapper that provides every namespace to client
// components the way the site layout + page providers do in the real app.
export { en };

export function withI18n(ui: React.ReactNode) {
  return (
    <I18nProvider locale="en" messages={en}>
      {ui}
    </I18nProvider>
  );
}

/** `params` for a public-site page or layout rendered in English. */
export const EN_PARAMS = { params: Promise.resolve({ lang: "en" }) };
