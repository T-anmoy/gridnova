import type { Page } from "@playwright/test";

// Public marketing routes. The /dashboard tree is Clerk-protected and excluded.
export const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/services",
  "/industries",
  "/projects",
  "/technology",
  "/leadership",
  "/sustainability",
  "/careers",
  "/contact",
  "/privacy",
  "/terms",
] as const;

/**
 * Collect console errors and uncaught page errors that originate from OUR code.
 * Third-party iframe noise (e.g. the Google Maps embed in the footer) is
 * excluded by origin so the assertion reflects our own bugs, not Google's.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const url = msg.location().url ?? "";
    // Only count messages from our own origin (or with no attributable URL).
    if (url === "" || url.includes("localhost")) {
      errors.push(`console.error: ${msg.text()} (${url})`);
    }
  });

  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  return errors;
}

/**
 * Perform a real touch swipe over an element via the Chrome DevTools Protocol.
 * Synthetic TouchEvents don't move native scrollers, so we dispatch genuine
 * touch input the compositor acts on. Returns after the gesture completes.
 */
export async function touchSwipe(
  page: Page,
  x: number,
  fromY: number,
  toY: number,
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: fromY }],
  });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const y = fromY + ((toY - fromY) * i) / steps;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}
