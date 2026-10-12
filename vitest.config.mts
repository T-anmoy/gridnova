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
  },
});
