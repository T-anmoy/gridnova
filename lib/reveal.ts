// One IntersectionObserver for every scroll-reveal on the page (ScrollReveal,
// and the few sections that reveal their own children).
//
// Content is visible by default: the server HTML has no hidden state, so a
// visitor without JavaScript, or on a phone that is still downloading it, sees
// everything. After hydration an element is hidden (data-reveal="hidden")
// only if it is still below the fold, then shown once it scrolls into view.
// Anything already on screen, or above it, is never hidden. The look (fade +
// short slide, easing, delay) lives in globals.css under [data-reveal].

const BELOW_FOLD = 0.92; // matches the old viewport margin of -8%

let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();

function shared(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer!.unobserve(entry.target);
          const show = callbacks.get(entry.target);
          callbacks.delete(entry.target);
          show?.();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
  }
  return observer;
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hide `targets` (default: `el` itself) if `el` is below the fold, and reveal
 * them when `el` scrolls into view. Targets get data-reveal="hidden", then
 * "shown". Returns a cleanup. Does nothing (everything stays visible) under
 * reduced motion, without IntersectionObserver, or when `el` is already in or
 * above view.
 */
export function observeReveal(el: Element, targets: Element[] = [el]): () => void {
  if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return () => {};
  if (el.getBoundingClientRect().top < window.innerHeight * BELOW_FOLD) return () => {};
  for (const t of targets) t.setAttribute("data-reveal", "hidden");
  callbacks.set(el, () => {
    for (const t of targets) t.setAttribute("data-reveal", "shown");
  });
  const io = shared();
  io.observe(el);
  return () => {
    io.unobserve(el);
    callbacks.delete(el);
  };
}

/**
 * A section revealing its own children together, with a stagger: every
 * element matching `selector` inside `root` gets `--reveal-delay` of
 * index × `stagger` seconds (plus any per-item CSS variables from `vars`,
 * e.g. the starting offset), and they are shown when `root` scrolls into view.
 */
export function observeRevealGroup(
  root: Element,
  selector: string,
  stagger: number,
  vars?: (index: number) => Record<string, string>,
): () => void {
  const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
  targets.forEach((t, i) => {
    t.style.setProperty("--reveal-delay", `${(i * stagger).toFixed(3)}s`);
    for (const [k, v] of Object.entries(vars?.(i) ?? {})) t.style.setProperty(k, v);
  });
  return observeReveal(root, targets);
}
