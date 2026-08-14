import { test, expect } from "@playwright/test";
import { touchSwipe } from "./helpers";

const CHAT_API = "**/api/v1/chat/message";

test.describe("Ask Nova", () => {
  test("opens the panel, sends a message, and shows Nova's reply", async ({
    page,
  }) => {
    // Mock the chat backend so the test is deterministic and offline.
    await page.route(CHAT_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Grid Nova offers Solar EPC and O&M across West Bengal.",
          lead_id: 1,
          customer_id: null,
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /open ask nova/i }).click();

    // Panel is open
    await expect(page.getByText("Ask Nova", { exact: true })).toBeVisible();
    const input = page.getByRole("textbox", { name: /message to nova/i });
    await expect(input).toBeVisible();

    // Send a message
    await input.fill("What services do you offer?");
    await input.press("Enter");

    // Visitor's message echoes into the thread…
    await expect(
      page.getByText("What services do you offer?"),
    ).toBeVisible();
    // …and Nova's mocked reply arrives (typed out).
    await expect(
      page.getByText(/Grid Nova offers Solar EPC and O&M/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("conversation thread scrolls with both a wheel and a touch gesture", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open ask nova/i }).click();

    // Fill the thread with several FAQ answers so it overflows and can scroll.
    const chips = page.getByRole("button", { name: /\?$/ });
    const count = await chips.count();
    for (let i = 0; i < count; i++) {
      await chips.nth(i).click();
      await page.waitForTimeout(120);
    }

    const thread = page.locator('[aria-label="Conversation with Nova"]');
    await expect(thread).toBeVisible();

    // The thread must be independently scrollable (not hijacked by Lenis).
    await expect(thread).toHaveAttribute("data-lenis-prevent", "");
    await expect
      .poll(async () =>
        thread.evaluate((el) => el.scrollHeight > el.clientHeight + 4),
      )
      .toBe(true);

    // Normal scroll (wheel)
    await thread.evaluate((el) => (el.scrollTop = 0));
    const box = (await thread.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(async () => thread.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);

    // Touch scroll (real touch input via CDP)
    await thread.evaluate((el) => (el.scrollTop = 0));
    await touchSwipe(
      page,
      box.x + box.width / 2,
      box.y + box.height - 20,
      box.y + 20,
    );
    await expect
      .poll(async () => thread.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
  });

  test("the typing FAQ bubble appears and cycles at BOTH mobile and desktop widths", async ({
    page,
  }) => {
    const bubble = page.getByRole("button", {
      name: /ask nova a quick question/i,
    });

    // --- Desktop width ---
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(bubble).toBeVisible({ timeout: 8_000 }); // appears ~3.5s after load
    const desktopFirst = (await bubble.innerText()).trim();
    await expect
      .poll(async () => (await bubble.innerText()).trim(), { timeout: 8_000 })
      .not.toBe(desktopFirst); // text is cycling/typing

    // --- Mobile width (same test run) ---
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(bubble).toBeVisible({ timeout: 8_000 });
    // Bubble stays within the viewport on small screens.
    const box = (await bubble.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
    const mobileFirst = (await bubble.innerText()).trim();
    await expect
      .poll(async () => (await bubble.innerText()).trim(), { timeout: 8_000 })
      .not.toBe(mobileFirst);
  });
});
