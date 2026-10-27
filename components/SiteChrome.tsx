"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { useLocale, useMessages } from "@/lib/i18n/client";
import { localizeHref } from "@/lib/i18n/config";
import { useBarePathname } from "@/lib/i18n/navigation";
import { ASSOCIATE_PORTAL_OPEN } from "@/lib/associates";

// Ask Nova is a below-the-fold floating widget (its bubble appears ~3.5s after
// load) and is position:fixed, so it never affects layout. Load its JS lazily
// so it's kept out of the initial bundle on every marketing page, and only
// once the browser is idle after hydration, so on a slow phone it does not
// compete with the page's own JavaScript and images.
const AskNova = dynamic(() => import("@/components/AskNova"), { ssr: false });

function useWhenIdle(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    // Safari has no requestIdleCallback.
    const id = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

// The field portals and their sign-in pages are app screens used on phones: the
// marketing nav, footer and the fixed Ask Nova launcher would cover their own
// tab bar and pinned action. While the portal switch is closed those routes
// show the "opening soon" page, which keeps the site chrome.
// The associate invitation sign-up (FE-17) is the same kind of screen as its sign-in.
const PORTAL_PREFIXES = ["/associates/portal", "/preferred/portal", "/associates/sign-in", "/associates/sign-up", "/preferred/sign-in"];

/** `pathname` is already stripped of its locale prefix (useBarePathname). */
export function isBareRoute(pathname: string, portalOpen: boolean = ASSOCIATE_PORTAL_OPEN): boolean {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/proposal/accept") || pathname.startsWith("/handover/")) return true;
  return portalOpen && PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = useBarePathname();
  const locale = useLocale();
  const t = useMessages("nav");
  // The internal dashboard, the standalone customer-facing proposal accept
  // page and the field portals opt out of the marketing chrome (nav / footer / Ask Nova).
  const bare = isBareRoute(pathname);
  const idle = useWhenIdle();

  // Human-readable names for the one-level-deep content routes, used to emit a
  // BreadcrumbList (Home → Page) for each without touching every page file.
  const routeName = (t.routes as Record<string, string>)[pathname];

  return (
    <>
      {!bare && routeName && (
        <JsonLd
          data={breadcrumbLd(
            [{ name: routeName, path: localizeHref(pathname, locale) }],
            { name: t.home, path: localizeHref("/", locale) },
          )}
        />
      )}
      {!bare && <Navigation />}
      {children}
      {!bare && <Footer />}
      {!bare && idle && <AskNova />}
    </>
  );
}
