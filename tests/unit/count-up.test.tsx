import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CountUp from '@/components/CountUp'

// gsap itself isn't reduced-motion-aware — CountUp's own guard is what must
// decide whether to animate at all, so gsap.to is mocked here to prove
// whether CountUp actually calls it, rather than relying on a real ~2s tween
// completing inside a test.
const gsapToSpy = vi.fn()
vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: vi.fn(),
    context: (fn: () => void) => {
      fn()
      return { revert: vi.fn() }
    },
    to: (...args: unknown[]) => gsapToSpy(...args),
  },
}))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }))

function stubReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  gsapToSpy.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CountUp', () => {
  it('renders the target value immediately as the initial (pre-animation) text', () => {
    stubReducedMotion(false)
    render(<CountUp value="₹2,71,626" />)
    expect(screen.getByText('₹2,71,626')).toBeInTheDocument()
  })

  it('animates via gsap.to toward the numeric target when motion is not reduced', () => {
    stubReducedMotion(false)
    render(<CountUp value="₹2,71,626" />)
    expect(gsapToSpy).toHaveBeenCalledTimes(1)
    const [, config] = gsapToSpy.mock.calls[0] as [unknown, { val: number }]
    expect(config.val).toBeCloseTo(271626)
  })

  it('skips the gsap animation entirely under prefers-reduced-motion', () => {
    stubReducedMotion(true)
    render(<CountUp value="₹2,71,626" />)
    expect(gsapToSpy).not.toHaveBeenCalled()
    // The correct final value must still be there — reduced motion means
    // instant, not missing.
    expect(screen.getByText('₹2,71,626')).toBeInTheDocument()
  })

  it('preserves a trailing suffix (e.g. "4,800+") alongside a leading currency prefix', () => {
    stubReducedMotion(true)
    render(<CountUp value="4,800+" />)
    expect(screen.getByText('4,800+')).toBeInTheDocument()
  })
})
