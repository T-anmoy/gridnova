import type { NextConfig } from "next";
// Importing lib/config validates NEXT_PUBLIC_API_URL: a production build fails
// here when it is missing or points at localhost.
import { API_BASE_URL } from "./lib/config";
import { clerkHostFromPublishableKey, securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
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
