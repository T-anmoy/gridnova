import { describe, it, expect } from 'vitest'
import { pageMetadata, breadcrumbLd, OG_IMAGE, SITE_URL } from '@/lib/seo'

describe('pageMetadata — every page gets the required SEO fields', () => {
  const m = pageMetadata({
    title: 'About Us',
    description: 'Grid Nova Energy — about the company.',
    path: '/about',
  })

  it('sets a title and description', () => {
    expect(m.title).toBe('About Us')
    expect(m.description).toBe('Grid Nova Energy — about the company.')
  })

  it('sets the canonical to the page path', () => {
    expect(m.alternates?.canonical).toBe('/about')
  })

  it('sets a complete Open Graph block with a real image and page URL', () => {
    const og = m.openGraph!
    expect(og.title).toContain('About Us')
    expect(og.description).toBe('Grid Nova Energy — about the company.')
    expect((og as { url?: string }).url).toBe(`${SITE_URL}/about`)
    expect((og as { images?: unknown[] }).images).toEqual([OG_IMAGE])
  })

  it('sets a Twitter summary_large_image card with an image', () => {
    const tw = m.twitter as { card?: string; images?: unknown[] }
    expect(tw.card).toBe('summary_large_image')
    expect(tw.images).toEqual([OG_IMAGE.url])
  })

  it('uses a real (non-placeholder) OG image path', () => {
    expect(OG_IMAGE.url).toMatch(/\/hero\/hero-desktop\.webp$/)
    expect(OG_IMAGE.width).toBeGreaterThan(1000)
  })
})

describe('breadcrumbLd', () => {
  it('prepends Home and builds absolute item URLs with 1-based positions', () => {
    const ld = breadcrumbLd([{ name: 'Projects', path: '/projects' }]) as {
      '@type': string
      itemListElement: { position: number; name: string; item: string }[]
    }
    expect(ld['@type']).toBe('BreadcrumbList')
    expect(ld.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/projects` },
    ])
  })
})
