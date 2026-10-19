import { test, expect } from "@playwright/test";
import { collectConsoleErrors } from "./helpers";

// Hindi and Bengali render with the right <html lang> and script attribute (which
// the CSS uses to pick the Devanagari / Bengali face), their own copy, and no
// console errors of ours.
const LOCALES = [
  { prefix: "/hi", lang: "hi", script: "devanagari", headline: /[ऀ-ॿ]/ },
  { prefix: "/bn", lang: "bn", script: "bengali", headline: /[ঀ-৿]/ },
  { prefix: "", lang: "en", script: "latin", headline: /[A-Za-z]/ },
];

for (const l of LOCALES) {
  test.describe(`locale ${l.lang}`, () => {
    for (const route of ["/", "/contact", "/solar-calculator"]) {
      test(`${l.prefix}${route} sets lang="${l.lang}" data-script="${l.script}"`, async ({ page }) => {
        const errors = collectConsoleErrors(page);
        await page.goto(`${l.prefix}${route === "/" && l.prefix ? "" : route}`);
        const html = page.locator("html");
        await expect(html).toHaveAttribute("lang", l.lang);
        await expect(html).toHaveAttribute("data-script", l.script);
        const h1 = (await page.locator("h1").first().textContent()) ?? "";
        expect(h1).toMatch(l.headline);
        expect(errors).toEqual([]);
      });
    }
  });
}

test("the language switcher keeps you on the same page and is a 44px target", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/contact");
  const hindi = page.getByRole("group").getByRole("button", { name: /hindi|हिन्दी/i }).first();
  const box = await hindi.boundingBox();
  // The pill is visually smaller; its invisible hit area (::after) is what makes it 44px,
  // so check the real target by hit-testing just outside the painted pill.
  expect(box).not.toBeNull();
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("lang") ?? null,
    { x: box!.x + box!.width / 2, y: box!.y + box!.height + 7 },
  );
  expect(hit).toBe("hi");
  await hindi.click();
  await expect(page).toHaveURL(/\/hi\/contact$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
});
