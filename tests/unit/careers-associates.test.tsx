import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CareersPage from "@/app/(site)/[lang]/careers/page";
import CareersEnhancer from "@/components/careers/CareersEnhancer";
import StickyApplyBar from "@/components/careers/StickyApplyBar";
import StepDots from "@/components/careers/StepDots";
import { ASSOCIATE_PORTAL_OPEN, ASSOCIATE_ROUTES } from "@/lib/associates";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";
import { EN_PARAMS, withI18n } from "./helpers/i18n";

const LOCALES = { en, hi, bn } as const;

async function renderPage(lang: keyof typeof LOCALES = "en") {
  const element = await CareersPage(lang === "en" ? EN_PARAMS : { params: Promise.resolve({ lang }) });
  return render(withI18n(element));
}

async function renderClosedPage() {
  vi.resetModules();
  vi.doMock("@/lib/associates", async (orig) => ({ ...(await orig<typeof import("@/lib/associates")>()), ASSOCIATE_PORTAL_OPEN: false }));
  const { default: Page } = await import("@/app/(site)/[lang]/careers/page");
  const result = render(withI18n(await Page(EN_PARAMS)));
  vi.doUnmock("@/lib/associates");
  return result;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Careers & Associates page", () => {
  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])("renders in %s with its own copy", async (lang) => {
    const t = LOCALES[lang].careers;
    await renderPage(lang);
    expect(screen.getByRole("heading", { level: 1, name: t.hero.title })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: t.programme.programmes[1].name })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t.jobs.title })).toBeInTheDocument();
  });

  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])("%s: no unconfirmed [bracket] text and no percentage anywhere", async (lang) => {
    const { container } = await renderPage(lang);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/[[\]]/);
    expect(text).not.toMatch(/%|percent|प्रतिशत|শতাংশ/i);
    expect(container.querySelector("mark.pending-value")).toBeNull();
  });

  it("states payout timing, attribution and notice as confirmed by the published policies", async () => {
    const { container } = await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("paid monthly, by the 10th of the following month");
    expect(text).toContain("until the project is completed or closed");
    expect(text).toContain("15 days’ written notice");
    expect(text).not.toMatch(/90 days|\b90\b/);
    // Territory commission is a possibility at Grid Nova's rate, never a promise.
    expect(text).toContain("You may also earn a territory commission");
    expect(text).not.toMatch(/plus a territory commission/i);
  });

  it("shows the no-fee statement in the hero without any interaction", async () => {
    await renderPage();
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    const noFee = within(hero).getByText(en.careers.hero.noFee);
    expect(noFee.closest("details")).toBeNull();
    expect(noFee.closest("[hidden]")).toBeNull();
  });

  it("keeps the anchors the nav, footer, homepage band and hero cards point to", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("#associates")).not.toBeNull();
    expect(container.querySelector("#careers")).not.toBeNull();
    expect(container.querySelector("#apply")).not.toBeNull();
    expect(screen.getByRole("link", { name: new RegExp(en.careers.hero.associateTitle) })).toHaveAttribute("href", "#associates");
    expect(screen.getByRole("link", { name: new RegExp(en.careers.hero.careersTitle) })).toHaveAttribute("href", "#careers");
  });

  it("links every Apply/Login button and the sticky Apply bar while the portal is open", async () => {
    expect(ASSOCIATE_PORTAL_OPEN).toBe(true);
    const { container } = await renderPage();
    for (const href of Object.values(ASSOCIATE_ROUTES)) {
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
    const bar = screen.getByTestId("sticky-apply-bar");
    expect(within(bar).getByText(en.careers.join.barApply).closest("a")).toHaveAttribute("href", "#apply");
    expect(container.querySelector('[aria-disabled="true"]')).toBeNull();
    expect(screen.queryByText(en.careers.join.openingSoon)).toBeNull();
  });

  it("while the portal is closed, renders non-clickable 'Opening soon' buttons — no apply/sign-in links, bar included", async () => {
    const { container } = await renderClosedPage();
    for (const href of Object.values(ASSOCIATE_ROUTES)) {
      expect(container.querySelector(`a[href="${href}"]`)).toBeNull();
    }
    const disabled = container.querySelectorAll('[role="link"][aria-disabled="true"]');
    expect(disabled).toHaveLength(5); // four band buttons + the sticky bar
    for (const el of disabled) {
      expect(el.tagName).toBe("SPAN");
      expect(el).toHaveTextContent(en.careers.join.openingSoon);
    }
    const bar = screen.getByTestId("sticky-apply-bar");
    expect(bar.querySelector("a")).toBeNull();
    expect(screen.getByText(en.careers.join.openingSoonNote)).toBeInTheDocument();
  });

  it("keeps every 'What you need' topic and every FAQ answer in disclosures that start closed", async () => {
    const { container } = await renderPage();
    const details = container.querySelectorAll("details");
    // 6 topics + 5 top questions + "More questions" + 2 inside it + 2 "More about this role"
    expect(details.length).toBe(16);
    expect(container.querySelector("details[open]")).toBeNull();
    for (const d of details) expect(d.firstElementChild?.tagName).toBe("SUMMARY");
    // Short summaries are visible on the closed topics.
    expect(screen.getByText(en.careers.needs.pay.summary)).toBeInTheDocument();
    // "More questions" holds the rest of the FAQ.
    const more = screen.getByText(en.careers.faq.more).closest("details")!;
    for (const item of en.careers.faq.items.slice(5)) expect(within(more).getByText(item.q)).toBeInTheDocument();
  });

  // Enter/Space on a focused <summary> is the browser's own activation (a
  // click), which jsdom does not emulate; it was checked in Chrome. Here:
  // the summary takes keyboard focus, and activating it toggles the panel.
  it("opens a disclosure from its focusable summary", async () => {
    const user = userEvent.setup();
    await renderPage();
    const summary = screen.getByText(en.careers.needs.eligibility.title).closest("summary")!;
    const details = summary.parentElement as HTMLDetailsElement;
    await user.tab();
    while (document.activeElement !== summary && document.activeElement !== document.body) await user.tab();
    expect(document.activeElement).toBe(summary);
    await user.click(summary);
    expect(details.open).toBe(true);
    await user.click(summary);
    expect(details.open).toBe(false);
  });

  it("switches programmes with ARIA tabs: click and Left/Right arrows", async () => {
    const user = userEvent.setup();
    await renderPage();
    const [assoc, preferred] = screen.getAllByRole("tab");
    const panels = () => screen.getAllByRole("tabpanel", { hidden: true });
    expect(assoc).toHaveAttribute("aria-selected", "true");
    expect(assoc).toHaveAttribute("tabindex", "0");
    expect(preferred).toHaveAttribute("tabindex", "-1");
    expect(panels()[0]).not.toHaveAttribute("hidden");
    expect(panels()[1]).toHaveAttribute("hidden");
    expect(panels()[1]).toHaveAttribute("aria-labelledby", preferred.id);

    assoc.focus();
    await user.keyboard("{ArrowRight}");
    expect(preferred).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(preferred);
    expect(panels()[0]).toHaveAttribute("hidden");
    expect(within(panels()[1]).getByText(en.careers.programme.programmes[1].forWho)).toBeInTheDocument();

    await user.keyboard("{ArrowRight}"); // wraps
    expect(assoc).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(assoc);
    await user.keyboard("{ArrowLeft}"); // wraps the other way
    expect(preferred).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}"); // other keys leave the selection alone
    expect(preferred).toHaveAttribute("aria-selected", "true");

    await user.click(assoc);
    expect(assoc).toHaveAttribute("aria-selected", "true");
  });

  it("walks through four illustrated steps in a focusable strip with a decorative dot per step", async () => {
    const { container } = await renderPage();
    const figures = screen.getAllByRole("figure");
    expect(figures).toHaveLength(4);
    for (const f of figures) expect(within(f).getByText("Illustration")).toBeInTheDocument();
    const strip = screen.getByRole("list", { name: en.careers.howItWorks.title });
    expect(strip).toHaveAttribute("tabindex", "0");
    expect(within(strip).getAllByRole("listitem")).toHaveLength(4);
    const dots = container.querySelector("#step-dots")!;
    expect(dots).toHaveAttribute("aria-hidden", "true");
    expect(dots.children).toHaveLength(4);
    expect(dots.children[0]).toHaveAttribute("data-current");
  });

  it("keeps step cards short on phones: mock screens only from md up", async () => {
    await renderPage();
    const figures = screen.getAllByRole("figure");
    for (const f of figures) {
      expect(f.className).toMatch(/(^|\s)hidden(\s|$)/);
      expect(f.className).toMatch(/(^|\s)md:block(\s|$)/);
    }
  });

  it("lays the mock screens out so nothing can spill past the card", async () => {
    await renderPage();
    const [, idCard, , commission] = screen.getAllByRole("figure");
    // ID card: the heading sits on its own line, outside the photo/QR row.
    const heading = within(idCard).getByText(en.careers.howItWorks.steps[1].screen.heading);
    expect(heading.parentElement?.className ?? "").not.toMatch(/\bflex\b/);
    // Commission: a list with the status pill pinned right, not a table.
    expect(commission.querySelector("table")).toBeNull();
    const pills = within(commission).getAllByText(/^(Paid|Approved|Earned)$/);
    expect(pills).toHaveLength(3);
    for (const pill of pills) expect(pill.className).toContain("shrink-0");
  });

  it("offers the helpline by call and WhatsApp, and keeps the CV email", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: en.careers.faq.call })).toHaveAttribute("href", "tel:+919874774440");
    expect(screen.getByRole("link", { name: en.careers.faq.whatsapp })).toHaveAttribute("href", "https://wa.me/919874774440");
    expect(screen.getByRole("link", { name: /email your cv/i }).getAttribute("href")).toMatch(/^mailto:careers@gridnova\.in/);
  });
});

describe("CareersEnhancer: sticky apply bar and step dots", () => {
  type Entry = { target: Element; isIntersecting: boolean };
  const observers: { cb: (entries: Entry[]) => void; targets: Element[] }[] = [];

  function stubObserver() {
    observers.length = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        o: (typeof observers)[number];
        constructor(cb: (entries: Entry[]) => void) {
          this.o = { cb, targets: [] };
          observers.push(this.o);
        }
        observe(t: Element) {
          this.o.targets.push(t);
        }
        unobserve() {}
        disconnect() {}
      },
    );
  }
  // Deliver entries to whichever observer watches the target.
  const fire = (entries: Entry[]) =>
    act(() => {
      for (const o of observers) {
        const mine = entries.filter((e) => o.targets.includes(e.target));
        if (mine.length) o.cb(mine);
      }
    });

  function renderBar() {
    return render(
      <>
        <section data-apply-bar-hide="" data-testid="hero" />
        <section data-apply-bar-hide="" data-testid="apply" />
        <footer data-testid="footer" />
        <StickyApplyBar>
          <a href="#apply">Apply now</a>
        </StickyApplyBar>
        <CareersEnhancer />
      </>,
    );
  }

  it("is a phone-only bar that starts hidden and out of the tab order", () => {
    stubObserver();
    renderBar();
    const bar = screen.getByTestId("sticky-apply-bar");
    expect(bar.className).toMatch(/(^|\s)md:hidden(\s|$)/);
    expect(bar.className).toMatch(/(^|\s)fixed(\s|$)/);
    // Leaves room for the Ask Nova bubble on the right.
    expect(bar.className).toContain("right-[5.5rem]");
    expect(bar).toHaveAttribute("data-state", "hidden");
    expect(bar).toHaveAttribute("inert");
  });

  it("shows once the hero has gone and hides again near the apply band or footer", () => {
    stubObserver();
    renderBar();
    const bar = screen.getByTestId("sticky-apply-bar");
    const [hero, apply, footer] = ["hero", "apply", "footer"].map((id) => screen.getByTestId(id));

    fire([{ target: hero, isIntersecting: true }, { target: apply, isIntersecting: false }, { target: footer, isIntersecting: false }]);
    expect(bar).toHaveAttribute("data-state", "hidden");

    fire([{ target: hero, isIntersecting: false }]);
    expect(bar).toHaveAttribute("data-state", "shown");
    expect(bar).not.toHaveAttribute("inert");

    fire([{ target: apply, isIntersecting: true }]);
    expect(bar).toHaveAttribute("data-state", "hidden");

    fire([{ target: apply, isIntersecting: false }, { target: footer, isIntersecting: true }]);
    expect(bar).toHaveAttribute("data-state", "hidden");
    expect(bar).toHaveAttribute("inert");
  });

  it("moves the current dot with the strip's scroll position", () => {
    stubObserver();
    render(
      <>
        <ol id="how-it-works-steps">
          <li>one</li>
          <li>two</li>
          <li>three</li>
        </ol>
        <StepDots count={3} />
        <CareersEnhancer />
      </>,
    );
    const strip = document.getElementById("how-it-works-steps")!;
    // jsdom has no layout: cards 300 px apart, strip scrolled to the second.
    screen.getAllByRole("listitem").forEach((li, i) => Object.defineProperty(li, "offsetLeft", { value: i * 300 }));
    const dots = Array.from(document.getElementById("step-dots")!.children);
    expect(dots.map((d) => d.hasAttribute("data-current"))).toEqual([true, false, false]);

    strip.scrollLeft = 310;
    act(() => strip.dispatchEvent(new Event("scroll")));
    expect(dots.map((d) => d.hasAttribute("data-current"))).toEqual([false, true, false]);
  });
});
