// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { localeRouting } from "@/lib/i18n/routing";

function req(path: string, cookie?: string) {
  return new NextRequest(`https://www.gridnova.in${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("localeRouting (proxy.ts locale step)", () => {
  it("rewrites unprefixed public URLs to the English segment internally", () => {
    const res = localeRouting(req("/about"))!;
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://www.gridnova.in/en/about");
    const home = localeRouting(req("/"))!;
    expect(home.headers.get("x-middleware-rewrite")).toBe("https://www.gridnova.in/en");
  });

  it("permanently redirects /en/... to the canonical unprefixed URL, keeping the query", () => {
    const res = localeRouting(req("/en/services?x=1"))!;
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://www.gridnova.in/services?x=1");
  });

  it("serves /hi and /bn URLs as-is", () => {
    expect(localeRouting(req("/hi/about"))).toBeUndefined();
    expect(localeRouting(req("/bn"))).toBeUndefined();
  });

  it("sends a visitor who chose Hindi/Bengali to their language on unprefixed URLs", () => {
    const res = localeRouting(req("/contact", "NEXT_LOCALE=bn"))!;
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://www.gridnova.in/bn/contact");
  });

  it("an English choice (or no choice) never redirects", () => {
    const res = localeRouting(req("/contact", "NEXT_LOCALE=en"))!;
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://www.gridnova.in/en/contact");
  });

  it("leaves the dashboard, proposal pages, API routes and files completely alone", () => {
    for (const path of ["/dashboard", "/dashboard/leads/4", "/proposal/new", "/proposal/accept/abc", "/api/contact", "/sitemap.xml", "/robots.txt"]) {
      expect(localeRouting(req(path, "NEXT_LOCALE=hi"))).toBeUndefined();
    }
  });
});
