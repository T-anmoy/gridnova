import { test, expect } from "@playwright/test";
import { collectConsoleErrors } from "./helpers";

// Customer-facing proposal accept page. The summary is fetched on the server; the
// scenarios come from tests/e2e/mock-backend-preload.cjs, keyed by token. The
// Accept click is a browser POST, mocked per test with page.route.
const ACCEPT_POST = "**/api/v1/proposals/accept/*";

test.describe("proposal accept page", () => {
  test("ready: shows the proposal and records the acceptance", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.route(ACCEPT_POST, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: "accepted", proposal_id: 7, accepted_at: "2026-10-12T05:00:00+00:00", already_accepted: false }),
          })
        : route.continue(),
    );
    await page.goto("/proposal/accept/tok-ready");

    await expect(page.getByRole("heading", { level: 1, name: /review & accept your proposal/i })).toBeVisible();
    await expect(page.getByText("Structural assessment and system design.")).toBeVisible();
    await expect(page.getByText(/4,50,000/)).toBeVisible();

    await page.getByRole("button", { name: /accept proposal/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /proposal accepted/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("ready: a failed accept keeps the proposal on screen and lets the customer retry", async ({ page }) => {
    let calls = 0;
    await page.route(ACCEPT_POST, (route) => {
      if (route.request().method() !== "POST") return route.continue();
      calls += 1;
      return calls === 1
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "boom" }) })
        : route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: "accepted", proposal_id: 7, accepted_at: "2026-10-12T05:00:00+00:00", already_accepted: false }),
          });
    });
    await page.goto("/proposal/accept/tok-ready");
    await page.getByRole("button", { name: /accept proposal/i }).click();
    // (Next also renders a route-announcer with role=alert, so scope to the page’s own message.)
    await expect(page.locator("p[role=alert]")).toContainText(/couldn’t record your acceptance/i);
    await expect(page.getByRole("button", { name: /accept proposal/i })).toBeEnabled();
    await page.getByRole("button", { name: /accept proposal/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /proposal accepted/i })).toBeVisible();
  });

  test("expired: says so, offers no Accept button", async ({ page }) => {
    await page.goto("/proposal/accept/tok-expired");
    await expect(page.getByRole("heading", { level: 1, name: /this proposal has expired/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /accept proposal/i })).toHaveCount(0);
  });

  test("already accepted: confirms it and shows the accepted value", async ({ page }) => {
    await page.goto("/proposal/accept/tok-accepted");
    await expect(page.getByRole("heading", { level: 1, name: /proposal accepted/i })).toBeVisible();
    await expect(page.getByText(/accepted value/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /accept proposal/i })).toHaveCount(0);
  });

  test("unknown link: a plain-language not-found, never a crash", async ({ page }) => {
    await page.goto("/proposal/accept/tok-missing");
    await expect(page.getByRole("heading", { level: 1, name: /proposal not found/i })).toBeVisible();
  });

  test("backend unreachable: an honest error with a retry button", async ({ page }) => {
    await page.goto("/proposal/accept/tok-anything-else");
    await expect(page.getByRole("heading", { level: 1, name: /something went wrong/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /try again|retry/i })).toBeVisible();
  });

  test("the private link is not indexable and sends no referrer", async ({ page }) => {
    const response = await page.goto("/proposal/accept/tok-ready");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("fits a 375px phone with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/proposal/accept/tok-ready");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const button = await page.getByRole("button", { name: /accept proposal/i }).boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(44);
  });
});
