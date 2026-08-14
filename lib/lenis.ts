import type Lenis from "lenis";

// Shared handle to the single Lenis instance created in SmoothScroll.tsx.
// Kept at module scope so any component (e.g. Navigation) can drive the
// smooth-scroll controller directly instead of fighting it with the native
// window.scrollTo() API.
let lenisInstance: Lenis | null = null;

export function setLenis(instance: Lenis | null) {
  lenisInstance = instance;
}

export function getLenis() {
  return lenisInstance;
}

// Smoothly scroll back to the top of the page. Uses Lenis when it's running
// (normal case); falls back to the native API for reduced-motion users, where
// Lenis is intentionally never initialised.
export function scrollToTop() {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { duration: 1.1 });
  } else if (typeof window !== "undefined") {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }
}
