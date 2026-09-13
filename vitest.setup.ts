import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import React from "react";

// Unmount React trees between tests so queries don't leak across cases.
afterEach(() => cleanup());

// jsdom doesn't implement matchMedia at all. A large share of this site's
// animated components (Hero, ServicesGrid, ServicesContent, CountUp,
// ScrollProgress, TiltCard, AskNova, SmoothScroll) each independently guard
// their own GSAP/animation setup with
// window.matchMedia("(prefers-reduced-motion: reduce)").matches, so any test
// that renders one for real hits this. Default to matches: false (no
// reduced-motion preference), same as a real browser with the OS setting
// off, so animation code paths run in tests unless a test explicitly
// overrides this for a reduced-motion-specific case.
// Guarded on `typeof window` (not just `!window.matchMedia`) because a Node-
// environment test file (`// @vitest-environment node`, used for Route
// Handler tests that need real undici Request/FormData behavior) has no
// `window` at all — this setup file runs for every test file regardless of
// its own environment override.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom doesn't implement IntersectionObserver either, which ScrollReveal's
// (and framer-motion's) `whileInView` depends on to know when to animate.
// This stub reports every observed element as immediately intersecting —
// the same outcome a real IntersectionObserver gives for anything already
// in the viewport at mount, which is what "was this ever revealed" tests
// actually care about, without needing a real scroll/geometry simulation.
if (!("IntersectionObserver" in globalThis)) {
  class MockIntersectionObserver {
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  // @ts-expect-error — partial stub, sufficient for whileInView in tests.
  globalThis.IntersectionObserver = MockIntersectionObserver;
}

// next/link → a plain anchor. Unit tests don't need the App Router context,
// and rendering the real component would require it. Object-form hrefs
// ({ pathname, query }) are stringified the same way Next itself resolves
// them, so tests can assert on the real resulting href/query string.
function resolveHref(href: string | { pathname?: string; query?: Record<string, unknown> }): string {
  if (typeof href === "string") return href;
  const pathname = href.pathname ?? "";
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    if (value !== undefined && value !== null) qs.set(key, String(value));
  }
  const queryString = qs.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string | { pathname?: string; query?: Record<string, unknown> };
  } & Record<string, unknown>) =>
    React.createElement("a", { href: resolveHref(href), ...props }, children),
}));

// next/navigation hooks used by client components under test.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));
