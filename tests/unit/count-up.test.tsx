import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import CountUp from '@/components/CountUp'

// CountUp has no animation library any more: an IntersectionObserver starts
// one requestAnimationFrame loop that writes the figure. These tests drive
// both by hand, so they assert what a visitor sees — the real figure without
// JavaScript or with reduced motion, a count from 0 that lands exactly on the
// figure otherwise — rather than how it is implemented.

function stubReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce') ? matches : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

let ioCallback: IntersectionObserverCallback | null = null
let observed: Element[] = []
let frames: FrameRequestCallback[] = []

beforeEach(() => {
  ioCallback = null
  observed = []
  frames = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        ioCallback = cb
      }
      observe(el: Element) {
        observed.push(el)
      }
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function intersect() {
  act(() => {
    ioCallback!([{ isIntersecting: true, target: observed[0] } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
}

function runFrame(time: number) {
  const pending = frames
  frames = []
  for (const cb of pending) cb(time)
}

describe('CountUp', () => {
  it('server-renders the real figure, so it is right without JavaScript', () => {
    expect(renderToString(<CountUp value="₹2,71,626" />)).toContain('₹2,71,626')
  })

  it('renders the target value immediately as the initial (pre-animation) text', () => {
    stubReducedMotion(false)
    render(<CountUp value="₹2,71,626" />)
    expect(screen.getByText('₹2,71,626')).toBeInTheDocument()
  })

  it('counts up from 0 once it scrolls into view and lands exactly on the figure, en-IN grouped', () => {
    stubReducedMotion(false)
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const { container } = render(<CountUp value="₹2,71,626" />)
    const span = container.querySelector('span')!
    expect(span.textContent).toBe('₹2,71,626') // nothing happens before it is seen
    intersect()
    runFrame(1000)
    expect(span.textContent).toBe('₹0')
    runFrame(2000) // halfway through the 2 s count: power2.out puts it at 75%
    expect(span.textContent).toBe('₹2,03,720')
    runFrame(3000)
    expect(span.textContent).toBe('₹2,71,626')
    expect(frames).toHaveLength(0) // the loop stops at the end
    now.mockRestore()
  })

  it('skips the animation entirely under prefers-reduced-motion', () => {
    stubReducedMotion(true)
    render(<CountUp value="₹2,71,626" />)
    expect(observed).toHaveLength(0)
    expect(frames).toHaveLength(0)
    // The correct final value must still be there — reduced motion means
    // instant, not missing.
    expect(screen.getByText('₹2,71,626')).toBeInTheDocument()
  })

  it('preserves a trailing suffix (e.g. "4,800+") alongside a leading currency prefix', () => {
    stubReducedMotion(true)
    render(<CountUp value="4,800+" />)
    expect(screen.getByText('4,800+')).toBeInTheDocument()
  })

  it('does not load GSAP', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const src = readFileSync(path.resolve(__dirname, '../../components/CountUp.tsx'), 'utf8')
    expect(src).not.toMatch(/from ["']gsap/)
  })
})
