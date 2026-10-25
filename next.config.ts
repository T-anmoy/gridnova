import type { NextConfig } from "next";
// Importing lib/config validates NEXT_PUBLIC_API_URL: a production build fails
// here when it is missing or points at localhost.
import { API_BASE_URL } from "./lib/config";
import { clerkHostFromPublishableKey, securityHeaders } from "./lib/security-headers";

// The visual viewport matrix (tests/visual, `npm run test:visual`) renders the
// dashboard and portals with Clerk swapped for a cookie-driven stub. That swap
// exists only in a build made with VISUAL_STUB_AUTH=1, which goes to its own
// output folder and refuses any API host that is not a reserved `.test` name,
// so it can never reach a deployment.
const visualStubAuth = process.env.VISUAL_STUB_AUTH === "1";
if (visualStubAuth && !new URL(API_BASE_URL).hostname.endsWith(".test")) {
  throw new Error(`VISUAL_STUB_AUTH=1 needs a *.test API host, not ${API_BASE_URL}.`);
}

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  ...(visualStubAuth && {
    distDir: ".next-visual",
    // Next adds the output folder's types to the tsconfig it builds with; this keeps tsconfig.json untouched.
    typescript: { tsconfigPath: "tsconfig.visual.json" },
    turbopack: {
      resolveAlias: {
        "@clerk/nextjs/server": "./tests/visual/clerk-stub/server.ts",
        "@clerk/nextjs": "./tests/visual/clerk-stub/client.tsx",
      },
    },
  }),
  images: {
    qualities: [75, 80, 85],
    // AVIF first, WebP for browsers without it. Next maps WebP q80 to AVIF
    // q50 (its own perceptual match); measured in FE-10 the mobile hero went
    // from 161 KB to 80 KB at the same width — it is the LCP image and the
    // largest high-priority download on the home page. Cost: a slower first
    // encode per variant, then served from cache.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return securityHeaders({
      apiOrigin: new URL(API_BASE_URL).origin,
      clerkHost: clerkHostFromPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      dev: process.env.NODE_ENV !== "production",
      // Emergency switch: CSP_REPORT_ONLY=1 turns the enforcing policy back into report-only.
      reportOnly: process.env.CSP_REPORT_ONLY === "1",
    });
  },
};

export default nextConfig;
