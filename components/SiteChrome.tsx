"use client";

import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { useLocale, useMessages } from "@/lib/i18n/client";
import { localizeHref } from "@/lib/i18n/config";
import { useBarePathname } from "@/lib/i18n/navigation";

// Ask Nova is a below-the-fold floating widget (its bubble appears ~3.5s after
// load) and is position:fixed, so it never affects layout. Load its JS lazily
// so it's kept out of the initial bundle on every marketing page.
const AskNova = dynamic(() => import("@/components/AskNova"), { ssr: false });

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = useBarePathname();
  const locale = useLocale();
  const t = useMessages("nav");
  // The internal dashboard and the standalone customer-facing proposal accept
  // page both opt out of the marketing chrome (nav / footer / Ask Nova).
  const isBareRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/proposal/accept");

  // Human-readable names for the one-level-deep content routes, used to emit a
  // BreadcrumbList (Home → Page) for each without touching every page file.
  const routeName = (t.routes as Record<string, string>)[pathname];

  return (
    <>
      {!isBareRoute && routeName && (
        <JsonLd
          data={breadcrumbLd(
            [{ name: routeName, path: localizeHref(pathname, locale) }],
            { name: t.home, path: localizeHref("/", locale) },
          )}
        />
      )}
      {!isBareRoute && <Navigation />}
      {children}
      {!isBareRoute && <Footer />}
      {!isBareRoute && <AskNova />}
    </>
  );
}
