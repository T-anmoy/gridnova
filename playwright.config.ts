import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, E2E_PORT } from "./tests/e2e/origin";

const PORT = E2E_PORT;
const BASE_URL = E2E_ORIGIN;

// E2E runs against a production build (next build && next start) so the tests
// exercise the same output users get — no dev-only warnings or double effects.
export default defineConfig({
  testDir: "./tests/e2e",
  // Warms the image optimizer cache once the server is up (see the file for why).
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Touch enabled so tests can exercise touch-scroll of the Ask Nova thread.
    hasTouch: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        // PW_CHANNEL=chrome uses the installed Google Chrome when `npx playwright install` has not been run.
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    // Self-contained: build then serve the production output on the test port.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Clerk's middleware requires a publishable key on every request. Fall back
    // to well-formed TEST keys so the public-site E2E suite runs without a real
    // Clerk account. Real keys (for dashboard/auth work) still win if present.
    env: {
      // Stands in for the backend on the server-side accept-page fetch (see the file).
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ./tests/e2e/mock-backend-preload.cjs`.trim(),
      // A production build refuses a missing or localhost API URL (lib/config.ts).
      // The suite never reaches a real backend (the chat is mocked per test), so
      // a syntactically valid, non-local placeholder is enough.
      NEXT_PUBLIC_API_URL: process.env.E2E_API_URL ?? "https://api.e2e.test",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
        "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k",
      CLERK_SECRET_KEY:
        process.env.CLERK_SECRET_KEY ??
        "sk_live_ZmFrZXNlY3JldGZvcnRlc3Rpbmdvbmx5MDAwMTIz",
    },
  },
});
