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

// Components render in isolation here, without the layouts that provide message
// namespaces. The portal's error wording and the shared date field (components/forms/DateField.tsx) sits inside
// many of them, so tests get its English copy when no provider supplied one; the
// app itself requires the provider.
vi.mock("@/lib/i18n/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/i18n/client")>();
  const en = (await import("@/messages/en.json")).default;
  return {
    ...mod,
    // portalFeedback (FE-19) is the portal's error wording, rendered by every portal card.
    useMessages: ((ns: string) =>
      ns === "dateField" || ns === "portalFeedback"
        ? (mod.useOptionalMessages(ns as "dateField") ?? (en as Record<string, unknown>)[ns])
        : mod.useMessages(ns as never)) as typeof mod.useMessages,
  };
});

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

// FE-17: the dashboard decides from GET /employees/me `permissions` (usePermissions).
// Hundreds of existing tests set the signed-in person with a mocked Clerk `useUser()`
// (`publicMetadata.role` / `roles`). This bridge turns those roles into the permissions
// the real BE-17 matrix gives them (tests/unit/fixtures/access-matrix.ts), so each test
// still means "as a Sales person …" — and now also proves the permission mapping keeps
// every role's screens. Tests of the hook itself call vi.unmock("@/lib/access/use-permissions").
afterEach(async () => {
  (await import("./tests/unit/helpers/permissions-bridge")).clearRoleOverride();
});
vi.mock("@/lib/access/use-permissions", async () => {
  const { permissionsForRolesHook } = await import("./tests/unit/helpers/permissions-bridge");
  return { usePermissions: permissionsForRolesHook };
});

// FE-19: NoAccess names the Admins from GET /access/admins. Dozens of guard tests render
// NoAccess without Clerk or a query client (and assert that no request is made), so the
// hook answers "not loaded" here; tests/unit/fe19-access-gaps.test.tsx uses the real one.
vi.mock("@/lib/access/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/access/api")>();
  return { ...mod, useAccessAdmins: () => ({ data: undefined, isLoading: false, error: null }) };
});
