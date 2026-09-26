import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { messagesFor, resolveLocale, type LangParams } from "./messages";
import type { Messages } from "./types";

type PageKey = keyof Messages["meta"]["pages"];

/**
 * A `generateMetadata` for a public page: title/description from
 * `meta.pages.<key>`, canonical at the locale's URL, hreflang alternates for
 * every language.
 */
export function localizedMetadata(key: PageKey, path: string) {
  return async function generateMetadata({ params }: LangParams): Promise<Metadata> {
    const locale = await resolveLocale(params);
    const { title, description } = messagesFor(locale).meta.pages[key];
    return pageMetadata({ title, description, path, locale });
  };
}
