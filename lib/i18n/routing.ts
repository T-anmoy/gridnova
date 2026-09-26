import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, isUnlocalizedPath } from "./config";

// Files served from /public or metadata routes (sitemap.xml, robots.txt,
// icon.svg …) must never be rewritten under a locale segment.
const HAS_FILE_EXTENSION = /\/[^/]+\.[^/]+$/;

/**
 * Locale routing for the public site, run from proxy.ts after Clerk's checks.
 *
 * - `/en/...`          → 308 to the unprefixed URL (English is canonical at `/`)
 * - `/hi/...`, `/bn/...` → served as-is
 * - unprefixed URL     → rewritten internally to `/en/...`, unless the visitor
 *                         previously chose Hindi or Bengali, in which case they
 *                         are redirected to that locale's URL
 * - `/dashboard`, `/proposal`, `/api`, files → untouched (returns undefined)
 */
export function localeRouting(req: NextRequest): NextResponse | undefined {
  const { pathname } = req.nextUrl;
  if (isUnlocalizedPath(pathname) || HAS_FILE_EXTENSION.test(pathname)) return undefined;

  const seg = pathname.split("/")[1];

  if (seg === DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (isLocale(seg)) return undefined;

  const preferred = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(preferred) && preferred !== DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${preferred}` : `/${preferred}${pathname}`;
    return NextResponse.redirect(url, 307);
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
  return NextResponse.rewrite(url);
}
