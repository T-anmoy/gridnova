import type { Metadata } from "next";
import "../globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import SiteChrome from "@/components/SiteChrome";
import ScrollProgress from "@/components/ScrollProgress";
import GlobalLoader from "@/components/GlobalLoader";
import JsonLd from "@/components/JsonLd";
import { LATIN_FONT_CLASSES } from "@/lib/fonts";
import { I18nProvider } from "@/lib/i18n/client";
import { chromeMessages, messagesFor } from "@/lib/i18n/dictionaries";
import { organizationSchema, localBusinessSchema, patnaLocalBusinessSchema } from "@/lib/structured-data";

// Root layout for the internal tools — /dashboard and /proposal. These stay
// English and unprefixed; they sit outside the public site's [lang] segment
// so the public site can set <html lang> per locale while staying static.
// Everything below matches the single root layout this app had before i18n.

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gridnova.in"),
  title: {
    default: "Grid Nova Energy | Engineering India's Clean Energy Future",
    template: "%s | Grid Nova Energy",
  },
};

export default function InternalRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={LATIN_FONT_CLASSES}>
      <head>
        <JsonLd data={organizationSchema} />
        <JsonLd data={localBusinessSchema} />
        <JsonLd data={patnaLocalBusinessSchema} />
      </head>
      <body>
        <GlobalLoader />
        <ScrollProgress />
        <SmoothScroll>
          {/* /proposal/new still shows the site nav + footer, in English. */}
          <I18nProvider locale="en" messages={chromeMessages(messagesFor("en"))}>
            <SiteChrome>{children}</SiteChrome>
          </I18nProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
