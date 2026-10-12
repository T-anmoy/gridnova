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
  },
  async headers() {
    return securityHeaders({
      apiOrigin: new URL(API_BASE_URL).origin,
      clerkHost: clerkHostFromPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      dev: process.env.NODE_ENV !== "production",
    });
  },
};

export default nextConfig;
