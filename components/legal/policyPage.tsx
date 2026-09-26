import type { Metadata } from "next";
import PolicyDocument from "@/components/legal/PolicyDocument";
import { getPolicy, type PolicySlug } from "@/content/policies";
import { messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { pageMetadata } from "@/lib/seo";

/** Metadata + page for one policy route (the five route files stay one line each). */
export function policyRoute(slug: PolicySlug) {
  async function generateMetadata({ params }: LangParams): Promise<Metadata> {
    const locale = await resolveLocale(params);
    const t = messagesFor(locale).legal;
    return pageMetadata({ title: t.titles[slug], description: t.descriptions[slug], path: `/${slug}`, locale });
  }
  async function Page({ params }: LangParams) {
    const locale = await resolveLocale(params);
    return <PolicyDocument doc={getPolicy(slug)} t={messagesFor(locale).legal} englishOnly={locale !== "en"} />;
  }
  return { generateMetadata, Page };
}
