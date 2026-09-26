import type { Metadata } from 'next'
import { LOCALES, LOCALE_META, localizeHref, type Locale } from '@/lib/i18n/config'

export const SITE_URL = 'https://www.gridnova.in'

// Default social-share image — a real brand hero photo (2560×1441, 16:9).
export const OG_IMAGE = {
  url: '/hero/hero-desktop.webp',
  width: 2560,
  height: 1441,
  alt: 'Grid Nova Energy engineers on a utility-scale solar installation',
}

/**
 * hreflang alternates for a public path: every locale plus x-default
 * (English, unprefixed).
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const l of LOCALES) languages[LOCALE_META[l].hreflang] = localizeHref(path, l)
  languages['x-default'] = path
  return languages
}

/**
 * Build complete, per-page metadata: unique title + description, canonical URL,
 * and full Open Graph + Twitter card tags (with a real OG image) so every route
 * is correct for search engines and social/WhatsApp link previews.
 *
 * Pass `locale` for public-site pages: the canonical then points at that
 * locale's URL and hreflang alternates are emitted for every language.
 * Internal pages (no locale) keep an English-only canonical.
 */
export function pageMetadata({
  title,
  description,
  path,
  locale,
  image = OG_IMAGE,
}: {
  title: string
  description: string
  path: string
  locale?: Locale
  image?: { url: string; width: number; height: number; alt: string }
}): Metadata {
  const localizedPath = locale ? localizeHref(path, locale) : path
  const url = `${SITE_URL}${localizedPath === '/' ? '' : localizedPath}`
  const ogTitle = `${title} | Grid Nova Energy`
  return {
    title,
    description,
    alternates: locale
      ? { canonical: localizedPath, languages: languageAlternates(path) }
      : { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: 'Grid Nova Energy',
      locale: LOCALE_META[locale ?? 'en'].ogLocale,
      alternateLocale: locale
        ? LOCALES.filter((l) => l !== locale).map((l) => LOCALE_META[l].ogLocale)
        : undefined,
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [image.url],
    },
  }
}

// BreadcrumbList JSON-LD for a one-or-more level trail. `Home` is prepended
// (pass a localized home entry on translated pages).
export function breadcrumbLd(
  trail: { name: string; path: string }[],
  home: { name: string; path: string } = { name: 'Home', path: '/' },
) {
  const items = [home, ...trail]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}
