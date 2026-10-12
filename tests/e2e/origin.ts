// One definition of the origin the e2e suite serves from, shared by
// playwright.config.ts and the console-error collector so they cannot disagree
// (they once did: the server was on 127.0.0.1 while the collector looked for
// "localhost", so every own-origin error was silently dropped).
export const E2E_PORT = 3100;
// 127.0.0.1 (not "localhost") so the browser never depends on DNS resolution.
export const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;

/**
 * Whether a console message's source URL is ours. An unattributed message
 * (empty URL, e.g. a page script's own console.error) counts as ours; anything
 * from another origin — the footer's Google Maps embed, a font CDN — does not.
 */
export function isOwnOrigin(url: string | undefined, origin: string = E2E_ORIGIN): boolean {
  if (!url) return true;
  try {
    return new URL(url).origin === origin;
  } catch {
    // Not a parseable URL (e.g. "chrome-error://…"): treat as unattributable → ours.
    return true;
  }
}
