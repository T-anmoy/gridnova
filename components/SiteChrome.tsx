"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

// Ask Nova is a below-the-fold floating widget (its bubble appears ~3.5s after
// load) and is position:fixed, so it never affects layout. Load its JS lazily
// so it's kept out of the initial bundle on every marketing page.
const AskNova = dynamic(() => import("@/components/AskNova"), { ssr: false });

// Human-readable names for the one-level-deep content routes, used to emit a
// BreadcrumbList (Home → Page) for each without touching every page file.
const ROUTE_NAMES: Record<string, string> = {
  "/about": "About",
  "/services": "Services",
  "/industries": "Industries",
  "/projects": "Projects",
  "/technology": "Technology",
  "/leadership": "Leadership",
  "/sustainability": "Sustainability",
  "/careers": "Careers",
  "/contact": "Contact",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
};

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The internal dashboard and the standalone customer-facing proposal accept
  // page both opt out of the marketing chrome (nav / footer / Ask Nova).
  const isBareRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/proposal/accept");

  const routeName = ROUTE_NAMES[pathname];

  return (
    <>
      {!isBareRoute && routeName && (
        <JsonLd data={breadcrumbLd([{ name: routeName, path: pathname }])} />
      )}
      {!isBareRoute && <Navigation />}
      {children}
      {!isBareRoute && <Footer />}
      {!isBareRoute && <AskNova />}
    </>
  );
}
