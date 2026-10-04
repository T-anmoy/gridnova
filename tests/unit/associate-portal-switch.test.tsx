import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { resolvePortalOpen } from "@/lib/associates";
import { EN_PARAMS, withI18n } from "./helpers/i18n";

vi.mock("@clerk/nextjs", () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

describe("resolvePortalOpen", () => {
  it("defaults to closed in production and open otherwise when unset", () => {
    expect(resolvePortalOpen(undefined, "production")).toBe(false);
    expect(resolvePortalOpen(undefined, "development")).toBe(true);
    expect(resolvePortalOpen(undefined, "test")).toBe(true);
    expect(resolvePortalOpen("", "production")).toBe(false);
  });

  it("lets the env var override either default", () => {
    expect(resolvePortalOpen("true", "production")).toBe(true);
    expect(resolvePortalOpen(" TRUE ", "production")).toBe(true);
    expect(resolvePortalOpen("false", "development")).toBe(false);
  });

  it("ignores unrecognised values rather than guessing", () => {
    expect(resolvePortalOpen("yes", "production")).toBe(false);
    expect(resolvePortalOpen("yes", "development")).toBe(true);
  });
});

describe.each([
  ["associates", "@/app/(site)/[lang]/associates/layout"],
  ["preferred", "@/app/(site)/[lang]/preferred/layout"],
])("%s layout", (_name, path) => {
  beforeEach(() => vi.resetModules());

  async function renderLayout(open: boolean) {
    vi.doMock("@/lib/associates", async (orig) => ({ ...(await orig<typeof import("@/lib/associates")>()), ASSOCIATE_PORTAL_OPEN: open }));
    const Layout = (await import(/* @vite-ignore */ path)).default;
    const el = await Layout({ children: <p>real portal content</p>, params: EN_PARAMS.params });
    return render(withI18n(el));
  }

  it("shows a friendly 'opening soon' page instead of the routes while closed", async () => {
    await renderLayout(false);
    expect(screen.getByRole("heading", { name: "Opening soon" })).toBeInTheDocument();
    expect(screen.queryByText("real portal content")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to Careers" })).toHaveAttribute("href", "/careers");
  });

  it("renders the routes normally while open", async () => {
    await renderLayout(true);
    expect(screen.getByText("real portal content")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Opening soon" })).toBeNull();
  });
});

describe("careers page while the portal is closed", () => {
  it("renders non-clickable 'opening soon' buttons and no Apply links", async () => {
    vi.resetModules();
    vi.doMock("@/lib/associates", async (orig) => ({ ...(await orig<typeof import("@/lib/associates")>()), ASSOCIATE_PORTAL_OPEN: false }));
    const { default: CareersPage } = await import("@/app/(site)/[lang]/careers/page");
    const { container } = render(withI18n(await CareersPage(EN_PARAMS)));
    expect(container.querySelector('a[href="/associates/apply/associate"]')).toBeNull();
    expect(container.querySelectorAll('[role="link"][aria-disabled="true"]').length).toBeGreaterThan(0);
  });
});
