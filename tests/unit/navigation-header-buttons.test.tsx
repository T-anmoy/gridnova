import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navigation from "@/components/Navigation";

// The reported bug: "Book a Call" and "Get Instant Estimate" (multi-word
// labels) wrapped to two lines in the desktop nav while single-word links
// (About, Services, ...) never could — because only these two lacked
// `whitespace-nowrap`. jsdom doesn't lay out text, so this asserts the actual
// mechanism of the fix (the class that forces single-line rendering) is
// present, rather than pixel geometry a unit test can't observe.
describe("Navigation — desktop CTA buttons don't wrap", () => {
  it("both 'Book a Call' and 'Get Instant Estimate' desktop links are single-line (whitespace-nowrap) and won't be squeezed narrower than their content (shrink-0)", () => {
    render(<Navigation />);
    const bookACall = screen.getByRole("link", { name: /^book a call$/i });
    const getEstimate = screen.getAllByRole("link", { name: /get instant estimate/i })[0];
    for (const link of [bookACall, getEstimate]) {
      expect(link.className).toContain("whitespace-nowrap");
      expect(link.className).toContain("shrink-0");
    }
  });

  it("the mobile drawer's own copies of these buttons are unaffected (full-width, no nowrap needed there)", async () => {
    const user = userEvent.setup();
    render(<Navigation />);
    // The drawer's markup only mounts once opened.
    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const links = screen.getAllByRole("link", { name: /get instant estimate/i });
    // One is the header-bar link (visible from md: up), the other is the
    // drawer's own separate full-width button.
    expect(links.length).toBeGreaterThanOrEqual(2);
    const drawerLink = links.find((l) => l.className.includes("w-full"));
    expect(drawerLink).toBeDefined();
  });
});

// The width-budget overflow bug from the previous fix: the pill's own
// max-width was narrower than the real content needed. This task raised the
// full-nav breakpoint to xl: (1280px), which freed up room to restore
// generous nav-link padding — these assertions pin the current real numbers.
describe("Navigation — pill width budget", () => {
  it("keeps both scrolled and unscrolled max-width comfortably above the real measured content requirement", () => {
    const { container } = render(<Navigation />);
    const pill = container.querySelector("header > div") as HTMLElement;
    // framer-motion's `animate` prop applies as an inline style even without
    // real layout — this is the unscrolled (initial) value.
    const maxWidth = parseFloat(pill.style.maxWidth);
    expect(maxWidth).toBeGreaterThanOrEqual(1220);
  });

  it("uses the restored, generous nav-link padding (px-3.5) now that the full nav only ever renders at xl: and up", () => {
    render(<Navigation />);
    const aboutLink = screen.getByRole("link", { name: "About" });
    expect(aboutLink.className).toContain("px-3.5");
  });

  it("left the CTA buttons' own padding untouched", () => {
    render(<Navigation />);
    const bookACall = screen.getByRole("link", { name: /^book a call$/i });
    const getEstimate = screen.getAllByRole("link", { name: /get instant estimate/i })[0];
    expect(bookACall.className).toContain("px-4");
    expect(getEstimate.className).toContain("px-4");
  });
});

// The actual task: the full 8-link nav plus both CTAs was cramming itself
// into tablet widths (iPad Pro portrait, 1024px) via the old lg: (1024px)
// breakpoint, with no comfortable room to breathe. The threshold is now
// xl: (1280px) — genuine desktop only.
describe("Navigation — breakpoint raised to xl: (tablet gets the hamburger too)", () => {
  it("the full nav and secondary 'Book a Call' CTA only ever appear at xl:, not lg:", () => {
    render(<Navigation />);
    const nav = screen.getByRole("link", { name: "About" }).closest("nav")!;
    const bookACall = screen.getByRole("link", { name: /^book a call$/i });
    expect(nav.className).toContain("xl:flex");
    expect(nav.className).not.toContain("lg:flex");
    expect(bookACall.className).toContain("xl:inline-flex");
    expect(bookACall.className).not.toContain("lg:inline-flex");
  });

  it("the hamburger button is hidden at xl: (not lg:), so it's active through tablet widths too", () => {
    render(<Navigation />);
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger.className).toContain("xl:hidden");
    expect(hamburger.className).not.toContain("lg:hidden");
  });

  it("the primary 'Get Instant Estimate' CTA is visible starting at md: (tablet), independent of the xl: full-nav breakpoint — the real design decision this task made", () => {
    render(<Navigation />);
    const estimate = screen.getAllByRole("link", { name: /get instant estimate/i })[0];
    expect(estimate.className).toContain("hidden md:inline-flex");
  });

  it("the hamburger gets a larger, more considered tap target and icon from md: (tablet) than the bare mobile version", () => {
    render(<Navigation />);
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger.className).toContain("h-11 w-11 md:h-12 md:w-12");
    expect(hamburger.className).toContain("hover:bg-white/10");
  });
});

// Tablet gets a refined drawer, not the mobile sheet unchanged: a fixed-width
// card anchored to the right edge instead of a full-bleed panel, plus a real
// shadow for depth (matching this site's other floating panels, e.g. AskNova).
describe("Navigation — drawer panel is tablet-aware, not borrowed unchanged from mobile", () => {
  it("becomes a fixed-width, right-anchored card from md: up, with its own shadow", async () => {
    const user = userEvent.setup();
    const { container } = render(<Navigation />);
    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const panel = container.querySelector('[class*="rounded-3xl"]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.className).toContain("md:left-auto");
    expect(panel.className).toContain("md:w-[400px]");
    expect(panel.className).toMatch(/shadow-\[/);
  });
});
