import type { MetadataRoute } from "next";
import { LOCALES, localizeHref } from "@/lib/i18n/config";
import { SITE_URL, languageAlternates } from "@/lib/seo";

// Public pages only — each is listed once per language, with hreflang
// alternates pointing at its siblings. /dashboard and /proposal are private.
const routes = [
  "/",
  "/about",
  "/services",
  "/estimate",
  "/solar-calculator",
  "/book-a-call",
  "/industries",
  "/projects",
  "/technology",
  "/leadership",
  "/sustainability",
  "/careers",
  "/contact",
  "/privacy",
  "/terms",
  "/associate-terms",
  "/commission-policy",
  "/payment-policy",
];

// The policy set was published on this date.
const POLICY_ROUTES = new Set(["/privacy", "/terms", "/associate-terms", "/commission-policy", "/payment-policy"]);
const POLICY_PUBLISHED = new Date("2026-10-23");

const absolute = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: absolute(localizeHref(route, locale)),
      lastModified: POLICY_ROUTES.has(route) ? POLICY_PUBLISHED : new Date(),
      changeFrequency: "monthly" as const,
      priority: route === "/" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          Object.entries(languageAlternates(route)).map(([lang, path]) => [lang, absolute(path)]),
        ),
      },
    })),
  );
}
