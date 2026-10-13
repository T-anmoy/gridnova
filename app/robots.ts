import type { MetadataRoute } from "next";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config";

// The signed-in portals exist under every locale prefix (/hi/associates/portal,
// /bn/preferred/portal, …). The public associate pages and the sign-in pages
// stay crawlable; only the signed-in areas are listed here.
const PORTALS = ["/associates/portal", "/preferred/portal"];
const PORTAL_PATHS = LOCALES.flatMap((l) => PORTALS.map((p) => (l === DEFAULT_LOCALE ? p : `/${l}${p}`)));

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private staff area, per-customer proposal links and the signed-in
      // associate / preferred portals must not be indexed.
      disallow: ["/dashboard", "/proposal/", "/api/", ...PORTAL_PATHS],
    },
    sitemap: "https://www.gridnova.in/sitemap.xml",
    host: "https://www.gridnova.in",
  };
}
