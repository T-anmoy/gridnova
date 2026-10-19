import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolve the `@/*` path alias from tsconfig.json natively (no plugin).
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // lib/config reads this once at import time.
    env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000" },
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Application code only: not the tests, generated copy, type declarations or Next's route boilerplate.
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "lib/dashboard/staff-copy.generated.json"],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
      // Baseline (measured 14 Oct 2026: statements 66.6, branches 67.8, functions 59.8, lines 69.2),
      // set just below so it only ever ratchets up. Raise these when coverage rises.
      thresholds: { statements: 65, branches: 66, functions: 58, lines: 67 },
    },
  },
});
