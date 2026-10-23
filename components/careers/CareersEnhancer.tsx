"use client";

import { useEffect } from "react";

// The careers page's only JavaScript. Everything it touches is rendered on
// the server and styled from attributes (aria-selected, data-current,
// data-state), so this just flips attributes — no client-rendered markup,
// which keeps the page's first-load JS at or below what it was before.
//   • Programme tabs   #programme-tabs: click, Left/Right arrows (Home/End are
//     optional in the ARIA tabs pattern and left out to stay in budget).
//   • Step dots        #step-dots: follow #how-it-works-steps as it scrolls.
//   • Sticky apply bar #apply-bar: shown once the hero is gone, hidden while
//     anything marked [data-apply-bar-hide] or the <footer> is on screen.
export default function CareersEnhancer() {
  useEffect(() => {
    const ac = new AbortController();
    const opts = { signal: ac.signal };
    programmeTabs(opts);
    stepDots(opts);
    const io = applyBar();
    return () => {
      ac.abort();
      io?.disconnect();
    };
  }, []);
  return null;
}

function programmeTabs(opts: AddEventListenerOptions) {
  const list = document.getElementById("programme-tabs");
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
  const n = tabs.length;

  const select = (i: number) =>
    tabs.forEach((tab, j) => {
      tab.setAttribute("aria-selected", String(i === j));
      tab.tabIndex = i === j ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")!)!.hidden = i !== j;
    });

  // A tab holds only its label, so the click target is the tab itself.
  list.addEventListener("click", (e) => {
    const i = tabs.indexOf(e.target as HTMLElement);
    if (i >= 0) select(i);
  }, opts);
  list.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(e.target as HTMLElement);
    const next = ({ ArrowRight: i + 1, ArrowLeft: i - 1 + n } as Record<string, number>)[(e as KeyboardEvent).key];
    if (i < 0 || next === undefined) return;
    e.preventDefault();
    select(next % n);
    tabs[next % n].focus();
  }, opts);
}

function stepDots(opts: AddEventListenerOptions) {
  const dots = Array.from(document.getElementById("step-dots")?.children ?? []);
  const strip = document.getElementById("how-it-works-steps");
  if (!strip) return;
  const cards = strip.children as HTMLCollectionOf<HTMLElement>;

  // The current dot is the card at the strip's left edge (cards snap there;
  // on tablets two fit side by side).
  strip.addEventListener("scroll", () => {
    const current = Math.round(strip.scrollLeft / (cards[1].offsetLeft - cards[0].offsetLeft));
    dots.forEach((d, i) => d.toggleAttribute("data-current", i === current));
  }, opts);
}

function applyBar() {
  const bar = document.getElementById("apply-bar");
  if (!bar) return;
  const visible = new Set<Element>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target);
      else visible.delete(e.target);
    }
    const show = !visible.size;
    bar.dataset.state = show ? "shown" : "hidden";
    // inert also keeps it out of the tab order and the accessibility tree.
    bar.toggleAttribute("inert", !show);
  });
  document.querySelectorAll("[data-apply-bar-hide], footer").forEach((t) => io.observe(t));
  return io;
}
