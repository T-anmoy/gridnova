// Locale configuration shared by the proxy, server components and client
// components. Pure functions only — no React, no Next.js runtime imports — so
// the proxy and unit tests can use it directly.

export const LOCALES = ["en", "hi", "bn"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Set by the language switcher; read by the proxy so a visitor who picked
// Hindi or Bengali keeps it on their next visit to an unprefixed URL.
export const LOCALE_COOKIE = "NEXT_LOCALE";

export type Script = "latin" | "devanagari" | "bengali";

export const LOCALE_META: Record<
  Locale,
  { label: string; short: string; hreflang: string; ogLocale: string; script: Script }
> = {
  en: { label: "English", short: "EN", hreflang: "en-IN", ogLocale: "en_IN", script: "latin" },
  hi: { label: "हिन्दी", short: "हि", hreflang: "hi-IN", ogLocale: "hi_IN", script: "devanagari" },
  bn: { label: "বাংলা", short: "বা", hreflang: "bn-IN", ogLocale: "bn_IN", script: "bengali" },
};

// These areas are internal tools or machine endpoints — they stay English and
// never carry a locale prefix.
const UNLOCALIZED_PREFIXES = ["/dashboard", "/proposal", "/api", "/trpc"];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function isUnlocalizedPath(pathname: string): boolean {
  return UNLOCALIZED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Split a browser pathname into its locale and the locale-free path. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const seg = pathname.split("/")[1];
  if (isLocale(seg)) {
    const rest = pathname.slice(seg.length + 1);
    return { locale: seg, path: rest === "" ? "/" : rest };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/**
 * Prefix an internal href with a locale. English stays unprefixed; hash-only,
 * external, mailto/tel and internal-tool links pass through untouched.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const [pathAndQuery, hash] = splitOnce(href, "#");
  const [path, query] = splitOnce(pathAndQuery, "?");
  if (isUnlocalizedPath(path)) return href;
  const bare = splitLocale(path).path;
  const prefixed = locale === DEFAULT_LOCALE ? bare : bare === "/" ? `/${locale}` : `/${locale}${bare}`;
  return prefixed + (query !== undefined ? `?${query}` : "") + (hash !== undefined ? `#${hash}` : "");
}

function splitOnce(value: string, sep: string): [string, string | undefined] {
  const i = value.indexOf(sep);
  return i === -1 ? [value, undefined] : [value.slice(0, i), value.slice(i + 1)];
}
