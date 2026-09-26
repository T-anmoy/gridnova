import { describe, it, expect } from "vitest";
import { localizeHref, splitLocale, isUnlocalizedPath } from "@/lib/i18n/config";

describe("localizeHref", () => {
  it("keeps English unprefixed and prefixes Hindi/Bengali", () => {
    expect(localizeHref("/about", "en")).toBe("/about");
    expect(localizeHref("/about", "hi")).toBe("/hi/about");
    expect(localizeHref("/", "bn")).toBe("/bn");
    expect(localizeHref("/", "en")).toBe("/");
  });

  it("re-localizes an already-prefixed path instead of stacking prefixes", () => {
    expect(localizeHref("/hi/about", "bn")).toBe("/bn/about");
    expect(localizeHref("/hi/about", "en")).toBe("/about");
  });

  it("keeps query strings and hashes", () => {
    expect(localizeHref("/book-a-call?source=contact", "hi")).toBe("/hi/book-a-call?source=contact");
    expect(localizeHref("/services#rooftop", "bn")).toBe("/bn/services#rooftop");
  });

  it("never touches internal tools, external, mailto, tel or hash-only links", () => {
    for (const href of ["/dashboard", "/dashboard/leads", "/proposal/accept/x", "/api/contact", "https://x.in", "mailto:a@b.in", "tel:+91", "#top", "//cdn.x"]) {
      expect(localizeHref(href, "hi")).toBe(href);
    }
  });
});

describe("splitLocale / isUnlocalizedPath", () => {
  it("splits the locale from the path", () => {
    expect(splitLocale("/hi/about")).toEqual({ locale: "hi", path: "/about" });
    expect(splitLocale("/bn")).toEqual({ locale: "bn", path: "/" });
    expect(splitLocale("/about")).toEqual({ locale: "en", path: "/about" });
    expect(splitLocale("/")).toEqual({ locale: "en", path: "/" });
  });

  it("doesn't mistake a path that merely starts with a locale's letters", () => {
    expect(splitLocale("/history")).toEqual({ locale: "en", path: "/history" });
  });

  it("flags only the internal areas as unlocalized", () => {
    expect(isUnlocalizedPath("/dashboard")).toBe(true);
    expect(isUnlocalizedPath("/proposal/new")).toBe(true);
    expect(isUnlocalizedPath("/api/x")).toBe(true);
    expect(isUnlocalizedPath("/dashboards")).toBe(false);
    expect(isUnlocalizedPath("/about")).toBe(false);
  });
});
