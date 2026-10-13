import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import robots from '@/app/robots'
import { setLenis, getLenis } from '@/lib/lenis'

const root = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.resolve(root, rel), 'utf8')

describe('SEO — private pages are noindex and disallowed', () => {
  const LAYOUTS = [
    'app/(site)/[lang]/associates/portal/layout',
    'app/(site)/[lang]/preferred/portal/layout',
    'app/(site)/[lang]/associates/sign-in/layout',
    'app/(site)/[lang]/preferred/sign-in/layout',
    'app/(site)/[lang]/verify/layout',
  ]
  it.each(LAYOUTS)('%s exports robots: noindex', async (rel) => {
    const mod = await import(/* @vite-ignore */ `${path.resolve(root, rel)}.tsx`)
    expect(mod.metadata.robots).toEqual({ index: false, follow: false })
  })

  it('the internal root layout (dashboard, proposal wizard, accept pages) is noindex', () => {
    expect(read('app/(internal)/layout.tsx')).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/)
  })

  it('robots.txt disallows the dashboard, proposals, API and every locale of both portals', () => {
    const rules = robots().rules as { disallow: string[] }
    for (const p of ['/dashboard', '/proposal/', '/api/', '/associates/portal', '/preferred/portal', '/hi/associates/portal', '/bn/preferred/portal']) {
      expect(rules.disallow).toContain(p)
    }
  })
})

describe('hero and loading — nothing hides the first paint', () => {
  it('the hero is CSS-driven (no GSAP), respects reduced motion, and never fades the photo in from 0', () => {
    const hero = read('components/Hero.tsx')
    expect(hero).not.toMatch(/gsap/i)
    expect(hero).toContain('useReducedMotion')
    const css = read('app/globals.css')
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'))
    expect(block).toContain('.hero-eyebrow')
    expect(block).not.toMatch(/\.hero-photo-wrap\s*\{/)
    // The entrance rules live only inside the no-preference media query.
    expect(css.slice(0, css.indexOf('@media (prefers-reduced-motion: no-preference)'))).not.toMatch(/\.hero-eyebrow\s*\{/)
  })

  it('the full-page loader is gone and the logo is a small WebP', () => {
    expect(existsSync(path.resolve(root, 'components/GlobalLoader.tsx'))).toBe(false)
    expect(read('app/(site)/[lang]/layout.tsx')).not.toContain('GlobalLoader')
    const webp = path.resolve(root, 'public/brand/header-logo.webp')
    expect(existsSync(webp)).toBe(true)
    expect(readFileSync(webp).length).toBeLessThan(20_000)
    expect(readFileSync(path.resolve(root, 'public/brand/header-logo.png')).length).toBeLessThan(50_000)
  })

  it('the site is wrapped in LazyMotion strict, and no file uses the full `motion` component', () => {
    expect(read('components/MotionProvider.tsx')).toContain('strict')
    const leftovers = execSync(`grep -rln "motion\\.\\(div\\|span\\|button\\|input\\|section\\|p\\)" app components --include=*.tsx || true`, { cwd: root }).toString().trim()
    expect(leftovers).toBe('')
  })
})

describe('SmoothScroll — Lenis only for a mouse/trackpad user who has not asked for less motion', () => {
  const instances: { destroy: ReturnType<typeof vi.fn>; raf: ReturnType<typeof vi.fn> }[] = []
  beforeEach(() => {
    instances.length = 0
    vi.resetModules()
    vi.doMock('lenis', () => ({
      default: class {
        destroy = vi.fn()
        raf = vi.fn()
        constructor() {
          instances.push(this)
        }
      },
    }))
  })
  afterEach(() => {
    vi.doUnmock('lenis')
    setLenis(null)
  })

  function media(matches: Record<string, boolean>) {
    window.matchMedia = ((query: string) => ({
      matches: Object.entries(matches).some(([q, v]) => query.includes(q) && v),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }

  async function mount() {
    const { default: SmoothScroll } = await import('@/components/SmoothScroll')
    const { getLenis: current } = await import('@/lib/lenis')
    const view = render(
      <SmoothScroll>
        <p>x</p>
      </SmoothScroll>,
    )
    await new Promise((r) => setTimeout(r, 20))
    return { view, current }
  }

  it('does not load or start Lenis on a touch device', async () => {
    media({ 'pointer: fine': false })
    const { current } = await mount()
    expect(instances).toHaveLength(0)
    expect(current()).toBeNull()
  })

  it('does not start it under prefers-reduced-motion', async () => {
    media({ 'pointer: fine': true, 'prefers-reduced-motion': true })
    await mount()
    expect(instances).toHaveLength(0)
  })

  it('starts it for a fine pointer, and destroys it on unmount', async () => {
    media({ 'pointer: fine': true })
    const { view, current } = await mount()
    expect(instances).toHaveLength(1)
    expect(current()).not.toBeNull()
    view.unmount()
    expect(instances[0].destroy).toHaveBeenCalled()
    expect(getLenis()).toBeNull()
  })
})
