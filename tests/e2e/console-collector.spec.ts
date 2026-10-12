import { test, expect } from "@playwright/test";
import { collectConsoleErrors } from "./helpers";
import { E2E_ORIGIN, isOwnOrigin } from "./origin";

// Self-test: the console-error check on every public page is only worth
// anything if the collector demonstrably fires. These prove it catches an
// error from our own origin and ignores one from a foreign origin.
test.describe("collectConsoleErrors self-test", () => {
  test("catches an error whose source is our own origin", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/about");
    // A 404 for one of OUR URLs makes Chrome log "Failed to load resource",
    // attributed to that URL.
    await page.evaluate(() => fetch("/__e2e_missing_resource__").then((r) => r.status));
    await expect.poll(() => errors.length, { timeout: 5_000 }).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("__e2e_missing_resource__"))).toBe(true);
  });

  test("catches an unattributed page-script console.error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/about");
    await page.evaluate(() => console.error("self-test: own-code error"));
    await expect.poll(() => errors.some((e) => e.includes("self-test: own-code error")), { timeout: 5_000 }).toBe(true);
  });

  test("ignores a failing request to another origin", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/about");
    // Answer the foreign request with a 404 so the browser logs its own
    // "Failed to load resource" for the foreign URL.
    await page.route("https://third-party.example/**", (route) => route.fulfill({ status: 404, body: "no" }));
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onerror = () => resolve();
          img.onload = () => resolve();
          img.src = "https://third-party.example/pixel.png";
        }),
    );
    await page.waitForTimeout(500);
    expect(errors.filter((e) => e.includes("third-party.example"))).toHaveLength(0);
  });

  test("isOwnOrigin compares the origin exactly, not as a substring", () => {
    expect(isOwnOrigin(`${E2E_ORIGIN}/x.js`)).toBe(true);
    expect(isOwnOrigin("")).toBe(true);
    expect(isOwnOrigin(undefined)).toBe(true);
    expect(isOwnOrigin("https://maps.google.com/embed")).toBe(false);
    // A foreign URL that merely contains our origin or "localhost" text is NOT ours.
    expect(isOwnOrigin(`https://evil.example/?next=${E2E_ORIGIN}`)).toBe(false);
    expect(isOwnOrigin("https://localhost.evil.example/x")).toBe(false);
  });
});
