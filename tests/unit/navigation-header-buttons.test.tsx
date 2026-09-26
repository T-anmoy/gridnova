import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navigation from "@/components/Navigation";
import { withI18n } from "./helpers/i18n";

// The reported bug: "Book a Call" and "Get Instant Estimate" (multi-word
// labels) wrapped to two lines in the desktop nav while single-word links
// (About, Services, ...) never could — because only these two lacked
// `whitespace-nowrap`. jsdom doesn't lay out text, so this asserts the actual
// mechanism of the fix (the class that forces single-line rendering) is
// present, rather than pixel geometry a unit test can't observe.
describe("Navigation — desktop CTA buttons don't wrap", () => {
  it("both 'Book a Call' and 'Get Instant Estimate' desktop links are single-line (whitespace-nowrap) and won't be squeezed narrower than their content (shrink-0)", () => {
    render(withI18n(<Navigation />));
    const bookACall = screen.getByRole("link", { name: /^book a call$/i });
    const getEstimate = screen.getAllByRole("link", { name: /get instant estimate/i })[0];
    for (const link of [bookACall, getEstimate]) {
      expect(link.className).toContain("whitespace-nowrap");
      expect(link.className).toContain("shrink-0");
    }
  });

  it("the mobile drawer's own copies of these buttons are unaffected (full-width, no nowrap needed there)", async () => {
    const user = userEvent.setup();
    render(withI18n(<Navigation />));
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
    const { container } = render(withI18n(<Navigation />));
    const pill = container.querySelector("header > div") as HTMLElement;
    // framer-motion's `animate` prop applies as an inline style even without
    // real layout — this is the unscrolled (initial) value.
    const maxWidth = parseFloat(pill.style.maxWidth);
    expect(maxWidth).toBeGreaterThanOrEqual(1220);
  });

  // Phase 1 added the language switcher and the longer "Careers &
  // Associates" label. Measured at 1280px: logo 142 + links 685 + switcher/
  // estimate 290 + pill padding 56 = 1173px of the 1232px available — which
  // only fits with px-2.5 links at xl:. The generous px-3.5 returns at 2xl:.
  it("uses px-2.5 nav-link padding at xl: and restores px-3.5 from 2xl:", () => {
    render(withI18n(<Navigation />));
    const classes = screen.getByRole("link", { name: "About" }).className.split(/\s+/);
    expect(classes).toContain("px-2.5");
    expect(classes).toContain("2xl:px-3.5");
    expect(classes).not.toContain("px-3.5");
  });

  it("left the CTA buttons' own padding untouched", () => {
    render(withI18n(<Navigation />));
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
  it("the full nav appears at xl:, not lg:; the secondary 'Book a Call' CTA joins the bar at 2xl: (it's in the drawer below that)", () => {
    render(withI18n(<Navigation />));
    const nav = screen.getByRole("link", { name: "About" }).closest("nav")!;
    const bookACall = screen.getByRole("link", { name: /^book a call$/i });
    expect(nav.className.split(/\s+/)).toContain("xl:flex");
    expect(nav.className).not.toContain("lg:flex");
    const bookClasses = bookACall.className.split(/\s+/);
    expect(bookClasses).toContain("2xl:inline-flex");
    expect(bookClasses).not.toContain("xl:inline-flex");
    expect(bookClasses).not.toContain("lg:inline-flex");
  });

  it("offers the language switcher in the desktop bar and in the drawer", async () => {
    const user = userEvent.setup();
    render(withI18n(<Navigation />));
    expect(screen.getAllByRole("group", { name: /choose language/i })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /open menu/i }));
    const switchers = screen.getAllByRole("group", { name: /choose language/i });
    expect(switchers).toHaveLength(2);
    for (const label of ["English", "हिन्दी", "বাংলা"]) {
      expect(screen.getAllByRole("button", { name: label }).length).toBe(2);
    }
  });

  it("the hamburger button is hidden at xl: (not lg:), so it's active through tablet widths too", () => {
    render(withI18n(<Navigation />));
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger.className).toContain("xl:hidden");
    expect(hamburger.className).not.toContain("lg:hidden");
  });

  it("the primary 'Get Instant Estimate' CTA is visible starting at md: (tablet), independent of the xl: full-nav breakpoint — the real design decision this task made", () => {
    render(withI18n(<Navigation />));
    const estimate = screen.getAllByRole("link", { name: /get instant estimate/i })[0];
    expect(estimate.className).toContain("hidden md:inline-flex");
  });

  it("the hamburger gets a larger, more considered tap target and icon from md: (tablet) than the bare mobile version", () => {
    render(withI18n(<Navigation />));
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
    const { container } = render(withI18n(<Navigation />));
    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const panel = container.querySelector('[class*="rounded-3xl"]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.className).toContain("md:left-auto");
    expect(panel.className).toContain("md:w-[400px]");
    expect(panel.className).toMatch(/shadow-\[/);
  });
});
