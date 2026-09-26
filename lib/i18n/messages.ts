import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";

export { messagesFor, chromeMessages, isMachineDraft } from "./dictionaries";

/** Props every public-site layout/page receives from the `[lang]` segment. */
export type LangParams = { params: Promise<{ lang: string }> };

/** The locale of a public-site request; 404 for anything unsupported. */
export async function resolveLocale(params: LangParams["params"]): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return lang;
}
