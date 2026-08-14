import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// 127.0.0.1 (not "localhost") so the browser never depends on DNS resolution.
const BASE_URL = `http://127.0.0.1:${PORT}`;

// E2E runs against a production build (next build && next start) so the tests
// exercise the same output users get — no dev-only warnings or double effects.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Touch enabled so tests can exercise touch-scroll of the Ask Nova thread.
    hasTouch: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], hasTouch: true } },
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
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
        "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k",
      CLERK_SECRET_KEY:
        process.env.CLERK_SECRET_KEY ??
        "sk_test_ZmFrZXNlY3JldGZvcnRlc3Rpbmdvbmx5MDAwMTIz",
    },
  },
});
