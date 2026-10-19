import { test, expect } from "@playwright/test";

// Signed-out visitors never reach a private screen: they land on this app's own
// sign-in page (not Clerk's hosted portal). Clerk is configured with well-formed
// placeholder keys in e2e, so the redirect itself is what is under test.
const CASES: [string, RegExp][] = [
  ["/dashboard", /\/dashboard\/sign-in/],
  ["/dashboard/leads", /\/dashboard\/sign-in/],
  ["/proposal/new", /\/dashboard\/sign-in/],
  ["/associates/portal", /\/associates\/sign-in/],
  ["/associates/portal/customers", /\/associates\/sign-in/],
  ["/preferred/portal", /\/preferred\/sign-in/],
  ["/hi/associates/portal", /\/associates\/sign-in/],
];

test.describe("unauthenticated redirects", () => {
  for (const [route, target] of CASES) {
    test(`${route} → sign-in`, async ({ page }) => {
      await page.goto(route, { waitUntil: "commit" });
      await expect(page).toHaveURL(target);
    });
  }

  test("the customer accept page and the public site stay open", async ({ page }) => {
    const response = await page.goto("/proposal/accept/tok-ready");
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/proposal/accept/tok-ready");
  });
});
