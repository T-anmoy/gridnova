import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// FE-10 (make the site fast on real phones). These pin the behaviour the
// performance work must keep: content visible without JavaScript, nothing
// hidden above the fold, reduced motion respected, no React work per scroll
// frame, third-party map only on request, Clerk only where it is used.

const root = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.resolve(root, rel), 'utf8')

// Modules are reset per test (lib/reveal keeps one observer per page), so the
// i18n wrapper must come from the same fresh module graph as the component.
async function freshI18n() {
  return (await import('./helpers/i18n')).withI18n
}

// ── Controllable IntersectionObserver / matchMedia / rAF ────────────────────

type IOInstance = { cb: IntersectionObserverCallback; targets: Element[]; options?: IntersectionObserverInit }
let observers: IOInstance[] = []

function installIO() {
  observers = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      inst: IOInstance
      constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.inst = { cb, targets: [], options }
        observers.push(this.inst)
      }
      observe(el: Element) {
        this.inst.targets.push(el)
      }
      unobserve(el: Element) {
        this.inst.targets = this.inst.targets.filter((t) => t !== el)
      }
      disconnect() {
        this.inst.targets = []
      }
      takeRecords() {
        return []
      }
    },
  )
}

function fire(el: Element, isIntersecting = true) {
  const inst = observers.find((o) => o.targets.includes(el))
  if (!inst) throw new Error('element is not observed')
  act(() => inst.cb([{ isIntersecting, target: el } as IntersectionObserverEntry], {} as IntersectionObserver))
}

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
}

// jsdom lays nothing out (every rect is at 0,0), so "below the fold" is a
// stubbed rect top.
function placeAt(top: number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: top, toJSON: () => ({}),
  } as DOMRect)
}

beforeEach(() => {
  vi.resetModules()
  installIO()
  setReducedMotion(false)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ── ScrollReveal ────────────────────────────────────────────────────────────

describe('ScrollReveal — CSS + one shared observer, visible by default', () => {
  async function load() {
    return (await import('@/components/ScrollReveal')).default
  }

  it('server HTML is visible: no hidden state and no inline opacity, so it shows without JavaScript', async () => {
    const ScrollReveal = await load()
    const html = renderToString(<ScrollReveal y={28} delay={0.1}>Hello</ScrollReveal>)
    expect(html).toContain('Hello')
    expect(html).not.toMatch(/opacity/)
    expect(html).not.toMatch(/data-reveal="hidden"/)
  })

  it('is hidden only after hydration and only below the fold, then shown when it scrolls into view', async () => {
    const ScrollReveal = await load()
    placeAt(5000)
    render(<ScrollReveal>Below</ScrollReveal>)
    const el = screen.getByText('Below')
    expect(el).toHaveAttribute('data-reveal', 'hidden')
    fire(el)
    expect(el).toHaveAttribute('data-reveal', 'shown')
  })

  it('never hides anything already on screen (the fold, the LCP)', async () => {
    const ScrollReveal = await load()
    placeAt(100)
    render(<ScrollReveal>Above</ScrollReveal>)
    expect(screen.getByText('Above')).not.toHaveAttribute('data-reveal', 'hidden')
    expect(observers.flatMap((o) => o.targets)).toHaveLength(0)
  })

  it('never hides anything under prefers-reduced-motion', async () => {
    setReducedMotion(true)
    const ScrollReveal = await load()
    placeAt(5000)
    render(<ScrollReveal>Calm</ScrollReveal>)
    expect(screen.getByText('Calm')).not.toHaveAttribute('data-reveal', 'hidden')
  })

  it('uses one IntersectionObserver for every reveal on the page', async () => {
    const ScrollReveal = await load()
    placeAt(5000)
    render(
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <ScrollReveal key={i}>Item {i}</ScrollReveal>
        ))}
      </>,
    )
    expect(observers).toHaveLength(1)
    expect(observers[0].targets).toHaveLength(12)
  })

  it('carries the same offsets and delay as before, as CSS variables', async () => {
    const ScrollReveal = await load()
    render(<ScrollReveal x={-40} y={0} delay={0.12}>Vars</ScrollReveal>)
    const el = screen.getByText('Vars')
    expect(el.style.getPropertyValue('--reveal-x')).toBe('-40px')
    expect(el.style.getPropertyValue('--reveal-y')).toBe('0px')
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('0.12s')
  })

  it('the hidden look is defined in CSS, with print showing everything', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/\[data-reveal="hidden"\]\s*\{\s*opacity: 0;/)
    expect(css).toMatch(/@media print \{\s*\[data-reveal="hidden"\] \{ opacity: 1; transform: none; \}/)
  })

  it('observeRevealGroup staggers a section’s children and shows them together', async () => {
    const { observeRevealGroup } = await import('@/lib/reveal')
    placeAt(5000)
    const section = document.createElement('section')
    section.innerHTML = '<div class="card"></div><div class="card"></div><div class="card"></div>'
    document.body.appendChild(section)
    observeRevealGroup(section, '.card', 0.08, () => ({ '--reveal-y': '40px' }))
    const cards = Array.from(section.querySelectorAll<HTMLElement>('.card'))
    expect(cards.map((c) => c.getAttribute('data-reveal'))).toEqual(['hidden', 'hidden', 'hidden'])
    expect(cards.map((c) => c.style.getPropertyValue('--reveal-delay'))).toEqual(['0.000s', '0.080s', '0.160s'])
    expect(cards[2].style.getPropertyValue('--reveal-y')).toBe('40px')
    fire(section)
    expect(cards.map((c) => c.getAttribute('data-reveal'))).toEqual(['shown', 'shown', 'shown'])
    section.remove()
  })

  it('no ScrollReveal-using page pulls framer-motion through it', () => {
    expect(read('components/ScrollReveal.tsx')).not.toMatch(/framer-motion/)
  })
})

// ── ScrollProgress ──────────────────────────────────────────────────────────

describe('ScrollProgress — no React state per scroll frame', () => {
  async function load() {
    return (await import('@/components/ScrollProgress')).default
  }

  it('is server-rendered as an empty bar (scaleX(0) in CSS), not injected after hydration', async () => {
    const ScrollProgress = await load()
    const html = renderToString(<ScrollProgress />)
    expect(html).toContain('scroll-progress')
    expect(html).toContain('aria-hidden="true"')
  })

  it('adds no scroll listener at all where CSS scroll timelines drive it', async () => {
    vi.stubGlobal('CSS', { supports: (q: string) => q.includes('animation-timeline') })
    const add = vi.spyOn(window, 'addEventListener')
    const ScrollProgress = await load()
    render(<ScrollProgress />)
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0)
  })

  it('elsewhere writes one compositor-only transform per animation frame, however many scroll events arrive', async () => {
    vi.stubGlobal('CSS', { supports: () => false })
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 3000 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 1000 })
    const ScrollProgress = await load()
    render(<ScrollProgress />)
    const bar = screen.getByTestId('scroll-progress')
    document.documentElement.scrollTop = 1000
    for (let i = 0; i < 10; i++) fireEvent.scroll(window)
    expect(frames).toHaveLength(1) // ten scroll events, one frame
    act(() => frames[0](0))
    expect(bar.style.transform).toBe('scaleX(0.5)')
    expect(bar.style.width).toBe('') // never animates width (layout)
  })

  it('stays out of the way under reduced motion (no listener; hidden in CSS)', async () => {
    vi.stubGlobal('CSS', { supports: () => false })
    setReducedMotion(true)
    const add = vi.spyOn(window, 'addEventListener')
    const ScrollProgress = await load()
    render(<ScrollProgress />)
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0)
    expect(read('app/globals.css')).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.scroll-progress \{ display: none; \}/)
  })
})

// ── Navigation ──────────────────────────────────────────────────────────────

describe('Navigation — scrolled state without a per-frame scroll callback', () => {
  async function renderNav() {
    const Navigation = (await import('@/components/Navigation')).default
    const withI18n = await freshI18n()
    return render(withI18n(<Navigation />))
  }

  it('switches to the compact pill when a 24px top sentinel leaves the viewport', async () => {
    const { container } = await renderNav()
    const pill = container.querySelector('header > div') as HTMLElement
    expect(pill.style.maxWidth).toBe('1400px')
    const sentinel = container.querySelector('div[aria-hidden="true"].absolute') as HTMLElement
    fire(sentinel, false)
    expect(pill.style.maxWidth).toBe('1340px')
    expect(pill.style.paddingTop).toBe('8px')
    fire(sentinel, true)
    expect(pill.style.maxWidth).toBe('1400px')
  })

  it('never subscribes to window scroll', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    await renderNav()
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0)
    expect(read('components/Navigation.tsx')).not.toMatch(/framer-motion/)
  })

  it('the drawer opens with focus inside, plays its exit, then unmounts', async () => {
    vi.useFakeTimers()
    await renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const panel = document.getElementById('site-mobile-nav')!
    expect(panel).toHaveAttribute('data-state', 'open')
    expect(panel.contains(document.activeElement)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    expect(document.getElementById('site-mobile-nav')).toHaveAttribute('data-state', 'closing')
    act(() => vi.advanceTimersByTime(300))
    expect(document.getElementById('site-mobile-nav')).toBeNull()
    vi.useRealTimers()
  })
})

// ── Footer map ──────────────────────────────────────────────────────────────

describe('Footer — the Google Maps embed loads only when asked for', () => {
  it('renders a same-size placeholder, and the iframe (focused) only after a tap', async () => {
    const Footer = (await import('@/components/Footer')).default
    const withI18n = await freshI18n()
    const { container } = render(withI18n(<Footer />))
    expect(container.querySelector('iframe')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /show map/i }))
    const frame = container.querySelector('iframe')!
    expect(frame).toHaveAttribute('title', 'Grid Nova Energy office location')
    expect(frame.getAttribute('src')).toContain('google.com/maps')
    expect(document.activeElement).toBe(frame)
  })

  it('every locale has the button label', () => {
    for (const l of ['en', 'hi', 'bn']) {
      const m = JSON.parse(read(`messages/${l}.json`))
      expect(typeof m.footer.showMap).toBe('string')
      expect(m.footer.showMap.length).toBeGreaterThan(0)
    }
  })
})

// ── Ask Nova ────────────────────────────────────────────────────────────────

describe('Ask Nova — heavy parts load on demand', () => {
  it('the zod + API-client transport is not a static dependency of the widget', () => {
    const widget = read('components/AskNova.tsx')
    expect(widget).not.toMatch(/^import[^;]*from "@\/lib\/ask-nova\/transport"/m)
    expect(widget).toContain('import("@/lib/ask-nova/transport")')
    // chat.ts re-exports types only, so importing it never pulls zod in.
    const chat = read('lib/ask-nova/chat.ts')
    expect(chat).not.toMatch(/^import (?!type)/m)
    expect(chat).not.toMatch(/^export \{[^}]*\} from/m)
  })

  it('the widget itself is fetched only once the browser is idle after hydration', () => {
    const chrome = read('components/SiteChrome.tsx')
    expect(chrome).toContain('requestIdleCallback')
    expect(chrome).toMatch(/\{!bare && idle && <AskNova \/>\}/)
  })

  it('the launcher pulse animates only transform and opacity (no per-frame repaint)', () => {
    const css = read('app/globals.css')
    const kf = css.slice(css.indexOf('@keyframes novaPulse'), css.indexOf('}', css.indexOf('50%', css.indexOf('@keyframes novaPulse'))) + 1)
    expect(kf).not.toMatch(/box-shadow/)
    expect(kf).toMatch(/transform: scale/)
  })
})

// ── Proxy: Clerk only where it is used ──────────────────────────────────────

describe('proxy.ts — public pages skip Clerk; every protected route still goes through it', () => {
  async function loadProxy() {
    const clerkCalls: string[] = []
    vi.doMock('@clerk/nextjs/server', () => ({
      createRouteMatcher: (p: (req: unknown) => boolean) => p,
      clerkMiddleware: () => (req: { nextUrl: { pathname: string } }) => {
        clerkCalls.push(req.nextUrl.pathname)
        return 'clerk'
      },
    }))
    const proxy = (await import('@/proxy')).default as unknown as (req: unknown, ev: unknown) => unknown
    const { NextRequest } = await import('next/server')
    const run = (p: string) => proxy(new NextRequest(`https://www.gridnova.in${p}`), {})
    return { run, clerkCalls }
  }

  it.each(['/', '/about', '/careers', '/hi', '/bn/projects', '/solar-calculator', '/contact', '/verify/GN-1'])(
    'public page %s never reaches clerkMiddleware (no handshake redirect)',
    async (p) => {
      const { run, clerkCalls } = await loadProxy()
      run(p)
      expect(clerkCalls).toEqual([])
    },
  )

  it.each([
    '/dashboard', '/dashboard/leads/1', '/dashboard/sign-in', '/proposal/new', '/proposal/accept/abc',
    '/api/proposal-inputs', '/associates/portal', '/hi/associates/portal/id-card', '/en/associates/portal',
    '/associates/sign-in', '/bn/preferred/portal', '/preferred/sign-in', '/associates/register',
  ])('%s still goes through clerkMiddleware', async (p) => {
    const { run, clerkCalls } = await loadProxy()
    expect(run(p)).toBe('clerk')
    expect(clerkCalls).toEqual([p])
  })
})
