import type { Metadata } from "next";
import "../../globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import SiteChrome from "@/components/SiteChrome";
import ScrollProgress from "@/components/ScrollProgress";
import GlobalLoader from "@/components/GlobalLoader";
import JsonLd from "@/components/JsonLd";
import DraftTranslationNotice from "@/components/i18n/DraftTranslationNotice";
import { fontClassesFor } from "@/lib/fonts";
import { I18nProvider } from "@/lib/i18n/client";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { chromeMessages, isMachineDraft, messagesFor, resolveLocale, type LangParams } from "@/lib/i18n/messages";
import { OG_IMAGE, SITE_URL, googleSiteVerification, languageAlternates } from "@/lib/seo";
import { organizationSchema, localBusinessSchema, patnaLocalBusinessSchema } from "@/lib/structured-data";

// Root layout for the public site. `[lang]` is en | hi | bn; the proxy maps
// unprefixed URLs to `en`, so English lives at `/` and the others at /hi, /bn.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const m = messagesFor(locale).meta.site;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: m.title, template: "%s | Grid Nova Energy" },
    description: m.description,
    keywords: m.keywords,
    alternates: { languages: languageAlternates("/") },
    // Search Console ownership tag — present only when the env var is set.
    ...(googleSiteVerification() ? { verification: { google: googleSiteVerification() } } : {}),
    openGraph: {
      title: m.title,
      description: m.ogDescription,
      url: SITE_URL,
      siteName: "Grid Nova Energy",
      locale: LOCALE_META[locale].ogLocale,
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: "Grid Nova Energy",
      description: m.twitterDescription,
      images: [OG_IMAGE.url],
    },
  };
}

export default async function SiteRootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode }> & LangParams) {
  const locale = await resolveLocale(params);
  const messages = messagesFor(locale);
  const { script } = LOCALE_META[locale];
  return (
    <html lang={locale} data-script={script} className={fontClassesFor(script)}>
      <head>
        <JsonLd data={organizationSchema} />
        <JsonLd data={localBusinessSchema} />
        <JsonLd data={patnaLocalBusinessSchema} />
      </head>
      <body>
        <GlobalLoader />
        <ScrollProgress />
        <SmoothScroll>
          <I18nProvider locale={locale} messages={chromeMessages(messages)}>
            <SiteChrome>
              {children}
              <DraftTranslationNotice draft={isMachineDraft(messages)} />
            </SiteChrome>
          </I18nProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
