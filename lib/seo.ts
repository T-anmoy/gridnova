import type { Metadata } from 'next'

export const SITE_URL = 'https://www.gridnova.in'

// Default social-share image — a real brand hero photo (2560×1441, 16:9).
export const OG_IMAGE = {
  url: '/hero/hero-desktop.webp',
  width: 2560,
  height: 1441,
  alt: 'Grid Nova Energy engineers on a utility-scale solar installation',
}

/**
 * Build complete, per-page metadata: unique title + description, canonical URL,
 * and full Open Graph + Twitter card tags (with a real OG image) so every route
 * is correct for search engines and social/WhatsApp link previews.
 */
export function pageMetadata({
  title,
  description,
  path,
  image = OG_IMAGE,
}: {
  title: string
  description: string
  path: string
  image?: { url: string; width: number; height: number; alt: string }
}): Metadata {
  const url = `${SITE_URL}${path}`
  const ogTitle = `${title} | Grid Nova Energy`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: 'Grid Nova Energy',
      locale: 'en_IN',
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

// BreadcrumbList JSON-LD for a one-or-more level trail. `Home` is prepended.
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  const items = [{ name: 'Home', path: '/' }, ...trail]
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
