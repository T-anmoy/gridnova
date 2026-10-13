import { E2E_ORIGIN } from "./origin";
import { PUBLIC_ROUTES } from "./helpers";

// Warm Next's on-demand image optimizer before any test runs.
//
// Why: in Next 16.3.1 a cold /_next/image request that the browser aborts
// (every page.goto/reload abandons in-flight image loads) leaves that image's
// optimizer entry unresolved, and every later request for the same image then
// hangs. A test that loads "/" at desktop width and then reloads it at 375px
// waits on the hero-mobile image forever, so page.goto() times out at 45 s.
// CI always starts with an empty image cache; locally it only happens after
// `.next/cache/images` is cleared. Fetching each image to completion here, with
// no browser to abort it, fills the cache once so no test hits the race.
// (Reproduced: curl --max-time 0.02 on a cold /_next/image URL, then any further
// request for the same URL hangs.)
const IMAGE_URL = /\/_next\/image\?[^"'\s,]+/g;

export default async function globalSetup(): Promise<void> {
  const urls = new Set<string>();
  for (const route of PUBLIC_ROUTES) {
    const html = await (await fetch(`${E2E_ORIGIN}${route}`)).text();
    for (const m of html.match(IMAGE_URL) ?? []) urls.add(m.replace(/&amp;/g, "&"));
  }
  // One at a time and read to the end: nothing here is ever aborted.
  for (const url of urls) {
    // Chromium's image Accept header: the optimizer keys its cache on the negotiated
    // format, so a bare `*/*` request would warm different entries than the browser asks for.
    const res = await fetch(`${E2E_ORIGIN}${url}`, {
      headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(60_000),
    });
    await res.arrayBuffer();
  }
  console.log(`[e2e] warmed ${urls.size} optimized images`);
}
