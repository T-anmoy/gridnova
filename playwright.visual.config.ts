import { defineConfig } from "@playwright/test";
import { VISUAL_ORIGIN, VISUAL_PORT } from "./tests/visual/matrix";

// The visual viewport matrix: every page in scope at every viewport, with a
// screenshot each and layout assertions (tests/visual/README.md).
//
// It has its own config because it needs its own build: the dashboard and the
// portals only render signed in, so this build swaps Clerk for a cookie-driven
// stub (VISUAL_STUB_AUTH=1, see next.config.ts) and goes to .next-visual, never
// touching the normal .next output or the e2e suite's server on port 3100.
const ENV = {
  VISUAL_STUB_AUTH: "1",
  // A reserved .test host: next.config.ts refuses the stub with anything else.
  // The browser never reaches it — tests/visual/matrix.ts proxies it to the
  // local backend (VISUAL_BACKEND, default http://127.0.0.1:8000).
  NEXT_PUBLIC_API_URL: "https://api.visual.test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k",
  CLERK_SECRET_KEY: "sk_live_ZmFrZXNlY3JldGZvcnRlc3Rpbmdvbmx5MDAwMTIz",
  // The customer accept page fetches on the server; reuse the e2e stand-in.
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ./tests/e2e/mock-backend-preload.cjs`.trim(),
};

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "./test-results/visual-matrix/playwright",
  globalSetup: "./tests/visual/setup.ts",
  globalTeardown: "./tests/visual/summary.ts",
  timeout: 90_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["dot"]],
  use: {
    baseURL: VISUAL_ORIGIN,
    // Reveal-on-scroll content is shown at once, so full-page screenshots show every section.
    contextOptions: { reducedMotion: "reduce" },
    // PW_CHANNEL=chrome runs the installed Google Chrome when Playwright's own browser is not installed.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  webServer: {
    command: `npx next build && npx next start -p ${VISUAL_PORT}`,
    url: `${VISUAL_ORIGIN}/about`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: ENV,
  },
});
