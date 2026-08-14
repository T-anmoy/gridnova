import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private staff area and per-customer proposal links must not be indexed.
      disallow: ["/dashboard", "/proposal/"],
    },
    sitemap: "https://www.gridnova.in/sitemap.xml",
    host: "https://www.gridnova.in",
  };
}
