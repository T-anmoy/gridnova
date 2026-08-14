import { test, expect, type Page } from "@playwright/test";

const VALID = {
  name: "Ravi Sharma",
  email: "ravi@company.in",
  phone: "9870012345",
  interest: "O&M Services",
  message: "We need a 50 kW rooftop system for our factory in Howrah.",
};

async function fillValidExcept(page: Page, omit: keyof typeof VALID | null) {
  if (omit !== "name") await page.getByLabel("Your Name").fill(VALID.name);
  if (omit !== "email") await page.getByLabel("Email Address").fill(VALID.email);
  if (omit !== "phone") await page.getByLabel("Phone (optional)").fill(VALID.phone);
  if (omit !== "interest")
    await page.getByLabel("What are you looking for?").selectOption(VALID.interest);
  if (omit !== "message")
    await page.getByLabel("Your Message").fill(VALID.message);
}

test.describe("Contact form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact");
  });

  test("empty required fields each show their error and block submit", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Please select a service")).toBeVisible();
    await expect(page.getByText("Message is required")).toBeVisible();

    // Did not navigate/submit (mailto handoff never fired)
    await expect(page).toHaveURL(/\/contact$/);
  });

  test("bad email shows the email error", async ({ page }) => {
    await fillValidExcept(page, "email");
    await page.getByLabel("Email Address").fill("notanemail");
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test("invalid phone shows the phone error", async ({ page }) => {
    await fillValidExcept(page, "phone");
    await page.getByLabel("Phone (optional)").fill("12345");
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(
      page.getByText("Enter a valid 10-digit mobile number"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test("too-short message shows the length error", async ({ page }) => {
    await fillValidExcept(page, "message");
    await page.getByLabel("Your Message").fill("too short");
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(
      page.getByText("Please write at least 20 characters"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/contact$/);
  });
});
