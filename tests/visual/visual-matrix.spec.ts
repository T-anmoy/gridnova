import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { OUT_DIR, PAGES, VIEWPORTS, caseName, measure, prepare, slug } from "./matrix";

// Every page in scope × every viewport: a full-page screenshot into
// test-results/visual-matrix/, then the two layout assertions — nothing wider
// than the screen, and no fixed/sticky element sitting on a control on load.
// Small tap targets and image problems are written to the report, not failed
// (tests/visual/summary.ts collects them into summary.md).

mkdirSync(`${OUT_DIR}/report`, { recursive: true });

for (const pageCase of PAGES) {
  test.describe(caseName(pageCase), () => {
    for (const v of VIEWPORTS) {
      test(v.name, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: v.width, height: v.height },
          deviceScaleFactor: v.dpr,
          hasTouch: v.width <= 1024,
          isMobile: v.width <= 932 && v.dpr > 1 && !v.name.includes("zoom"),
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        try {
          await prepare(page, pageCase.principal);
          if (v.rootFontPct) {
            await page.addInitScript((pct) => {
              document.addEventListener("DOMContentLoaded", () => {
                document.documentElement.style.fontSize = `${pct}%`;
              });
            }, v.rootFontPct);
          }
          // A fake clock lets the Ask Nova teaser (shown 3.5 s after load) appear without waiting.
          await page.clock.install();
          await page.goto(pageCase.path, { waitUntil: "load" });
          await page.clock.runFor(4_000);
          await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
          await page.clock.runFor(1_000);
          await page.evaluate(() => document.fonts.ready);

          // On load: overflow, overlap and tap targets as the visitor first sees the page.
          const atLoad = await page.evaluate(measure);
          // Then scroll through once so lazy images load, and judge images (and overflow) on the whole page.
          const height = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < height; y += v.height) {
            await page.evaluate((top) => window.scrollTo(0, top), y);
            // Real time, not the fake clock: the browser needs rendered frames to start lazy loads.
            await page.waitForTimeout(60);
          }
          await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
          for (let i = 0; i < 40; i++) {
            const pending = await page.evaluate(() => Array.from(document.images).filter((img) => !img.complete).length);
            if (!pending) break;
            await page.waitForTimeout(100);
          }
          const scrolled = await page.evaluate(measure);
          await page.evaluate(() => window.scrollTo(0, 0));
          const result = {
            scrollWidth: Math.max(atLoad.scrollWidth, scrolled.scrollWidth),
            innerWidth: atLoad.innerWidth,
            findings: [
              ...atLoad.findings.filter((f) => f.kind !== "distorted-image" && f.kind !== "upscaled-image"),
              ...scrolled.findings.filter((f) => f.kind === "distorted-image" || f.kind === "upscaled-image" ||
                (f.kind === "overflow" && !atLoad.findings.some((a) => a.detail === f.detail))),
            ],
          };
          writeFileSync(
            `${OUT_DIR}/report/${slug(caseName(pageCase))}__${v.name}.json`,
            JSON.stringify({ path: pageCase.path, viewport: v.name, finalUrl: page.url(), ...result }, null, 1),
          );
          // Chromium cannot capture more than 16,384 device pixels in one image (it repeats the
          // page beyond that), so a tall page is saved as consecutive parts.
          const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
          const part = Math.floor(16_000 / v.dpr);
          for (let y = 0, n = 1; y < fullHeight; y += part, n++) {
            await page.screenshot({
              path: `${OUT_DIR}/${slug(caseName(pageCase))}/${v.name}${fullHeight > part ? `-part${n}` : ""}.jpg`,
              fullPage: true,
              clip: { x: 0, y, width: v.width, height: Math.min(part, fullHeight - y) },
              type: "jpeg",
              quality: 60,
            });
          }

          expect(result.scrollWidth, "page is wider than the viewport").toBeLessThanOrEqual(result.innerWidth);
          const overflow = result.findings.filter((f) => f.kind === "overflow" || f.kind === "collapsed").map((f) => f.detail);
          expect(overflow, "elements stick out of the viewport").toEqual([]);
          const unreachable = result.findings.filter((f) => f.kind === "unreachable").map((f) => f.detail);
          expect(unreachable, "controls in a fixed panel that cannot be scrolled to").toEqual([]);
          const overlap = result.findings.filter((f) => f.kind === "overlap" || f.kind === "covered-fixed").map((f) => f.detail);
          expect(overlap, "a fixed/sticky element covers a control on load").toEqual([]);
        } finally {
          await context.close();
        }
      });
    }
  });
}
