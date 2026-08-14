import { test, expect } from "@playwright/test";
import { PUBLIC_ROUTES, collectConsoleErrors } from "./helpers";

test.describe("Every public page", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} loads with no console errors and a visible footer`, async ({
      page,
    }) => {
      const errors = collectConsoleErrors(page);

      await page.goto(route, { waitUntil: "load" });

      // Footer must be present and visible immediately on load — no reliance on
      // a scroll-triggered reveal (this regressed multiple times before).
      const footer = page.locator("footer");
      await expect(footer).toBeVisible();
      await expect(
        footer.getByText(/All rights\s*reserved/i),
      ).toBeVisible();

      // Give late microtasks a beat to surface any deferred errors.
      await page.waitForTimeout(300);
      expect(errors, `Console errors on ${route}:\n${errors.join("\n")}`).toEqual(
        [],
      );
    });
  }
});
