import { describe, it, expect, vi, afterEach } from 'vitest'
import robots from '@/app/robots'
import { generateMetadata } from '@/app/(site)/[lang]/layout'
import { googleSiteVerification } from '@/lib/seo'

// next/font only works inside Next's compiler.
vi.mock('@/lib/fonts', () => ({ fontClassesFor: () => '', LATIN_FONT_CLASSES: '' }))

afterEach(() => vi.unstubAllEnvs())

const params = (lang: string) => ({ params: Promise.resolve({ lang }) })

describe('SC — Google Search Console verification tag', () => {
  it('is present in the public layout metadata when the env var is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', 'abc123_verification-token')
    for (const lang of ['en', 'hi', 'bn']) {
      const meta = await generateMetadata(params(lang))
      expect(meta.verification).toEqual({ google: 'abc123_verification-token' })
    }
  })

  it('is absent when the env var is unset or blank', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', '')
    expect((await generateMetadata(params('en'))).verification).toBeUndefined()
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', '   ')
    expect(googleSiteVerification()).toBeUndefined()
    expect('verification' in (await generateMetadata(params('en')))).toBe(false)
  })
})

describe('RB — robots', () => {
  const disallow = () => {
    const rules = robots().rules
    const r = Array.isArray(rules) ? rules[0] : rules
    return ([] as string[]).concat(r.disallow ?? [])
  }

  it('keeps the existing private areas and adds every locale form of the signed-in portals', () => {
    const d = disallow()
    expect(d).toEqual(
      expect.arrayContaining([
        '/dashboard',
        '/proposal/',
        '/associates/portal',
        '/preferred/portal',
        '/hi/associates/portal',
        '/hi/preferred/portal',
        '/bn/associates/portal',
        '/bn/preferred/portal',
      ])
    )
  })

  it('does not block the public associate pages or the sign-in pages', () => {
    const d = disallow()
    for (const open of ['/associates', '/preferred', '/associates/sign-in', '/preferred/sign-in', '/hi/associates/apply', '/careers']) {
      expect(d.some((rule) => open === rule || open.startsWith(rule.endsWith('/') ? rule : `${rule}/`))).toBe(false)
    }
  })
})
