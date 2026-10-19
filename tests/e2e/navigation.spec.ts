import { test, expect, type Page } from "@playwright/test";

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

// Scroll the page down via a real wheel gesture (Lenis-driven) and wait until
// it has actually moved, so the scroll-to-top assertion is meaningful.
async function scrollDown(page: Page) {
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 1600);
  await expect.poll(() => scrollY(page), { timeout: 5_000 }).toBeGreaterThan(400);
}

test.describe("Scroll-to-top on the current page", () => {
  test("header logo scrolls to top when already on /", async ({ page }) => {
    await page.goto("/");
    await scrollDown(page);
    await page.locator('header a[href="/"]').first().click();
    await expect.poll(() => scrollY(page), { timeout: 5_000 }).toBeLessThan(50);
  });

  test("footer logo scrolls to top when already on /", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect.poll(() => scrollY(page), { timeout: 5_000 }).toBeGreaterThan(400);
    await page.locator('footer a[aria-label="Grid Nova Energy — home"]').click();
    await expect.poll(() => scrollY(page), { timeout: 5_000 }).toBeLessThan(50);
  });

  test("footer copyright line scrolls to top when already on /", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect.poll(() => scrollY(page), { timeout: 5_000 }).toBeGreaterThan(400);
    await page.locator("footer").getByText(/All rights\s*reserved/i).click();
    await expect.poll(() => scrollY(page), { timeout: 5_000 }).toBeLessThan(50);
  });
});

test.describe("Logos navigate normally from another page", () => {
  test("header logo navigates home from /about", async ({ page }) => {
    await page.goto("/about");
    await page.locator('header a[href="/"]').first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("footer copyright navigates home from /industries", async ({ page }) => {
    await page.goto("/industries");
    await page.locator("footer").getByText(/All rights\s*reserved/i).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("opens and closes via its button, and closes on an outside click", async ({
    page,
  }) => {
    await page.goto("/");

    const openBtn = page.getByRole("button", { name: "Open menu" });
    const closeBtn = page.getByRole("button", { name: "Close menu" });

    // Open, then close with the X button
    await openBtn.click();
    await expect(closeBtn).toBeVisible();
    await expect(
      // The menu's own link; the footer also has an "About" link.
      page.getByRole("navigation").getByRole("link", { name: "About" }),
    ).toBeVisible();
    await closeBtn.click();
    await expect(openBtn).toBeVisible();

    // Open again, then close by clicking the backdrop (outside the panel)
    await openBtn.click();
    await expect(closeBtn).toBeVisible();
    // The panel is inset 12px from the left edge, so x=4 is always backdrop, whatever the panel's height
    // (the 44px language buttons made it taller than the old fixed point below it).
    await page.mouse.click(4, 400);
    await expect(openBtn).toBeVisible();
  });
});
