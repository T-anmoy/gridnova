import type { Page } from "@playwright/test";

export const VISUAL_PORT = 3200;
export const VISUAL_ORIGIN = `http://127.0.0.1:${VISUAL_PORT}`;
export const VISUAL_API = "https://api.visual.test";
/** The real backend the stub API host is proxied to (development mode, so it accepts the dev headers). */
export const VISUAL_BACKEND = (process.env.VISUAL_BACKEND ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
export const OUT_DIR = "test-results/visual-matrix";

export interface Viewport {
  name: string;
  width: number;
  height: number;
  /** Device pixel ratio: 2 on phones and tablets, so blurry (upscaled) images show up. */
  dpr: number;
  /** Root font size in percent, for Android "large font". */
  rootFontPct?: number;
}

const vp = (width: number, height: number, name = `${width}x${height}`, extra: Partial<Viewport> = {}): Viewport => ({
  name,
  width,
  height,
  dpr: width < 1280 ? 2 : 1,
  ...extra,
});

export const VIEWPORTS: Viewport[] = [
  // Phones, portrait
  vp(320, 568), vp(360, 800), vp(375, 667), vp(390, 844), vp(412, 915), vp(430, 932),
  // Phones, landscape
  vp(800, 360), vp(932, 430),
  // Tablets
  vp(600, 960), vp(768, 1024), vp(820, 1180), vp(834, 1194), vp(1024, 768), vp(1024, 1366),
  // Laptops and desktops
  vp(1280, 720), vp(1366, 768), vp(1440, 900), vp(1920, 1080), vp(2560, 1440),
  // 200 % browser zoom at 1280×720 is a 640×360 CSS viewport at twice the pixel density.
  vp(640, 360, "1280x720-zoom200", { dpr: 2 }),
  // Android "large font": the root font size at 125 %.
  vp(360, 800, "360x800-font125", { rootFontPct: 125 }),
];

// `staff:uninvited` is a signed-in person the backend does not know: GET /employees/me
// answers 403 not_invited (faked here, the backend's dev headers create no such person).
// Several roles join with "+" (`staff:sales+proposal_desk`), sent as X-Employee-Roles.
export type Principal = `staff:${string}` | `associate:${string}` | null;

export interface PageCase {
  path: string;
  principal: Principal;
  /** Names the case (test title, screenshot folder) when the same path is checked as someone else too. */
  label?: string;
}

const PUBLIC = [
  "", "/about", "/services", "/industries", "/projects", "/technology", "/leadership", "/sustainability",
  "/careers", "/contact", "/privacy", "/terms", "/associate-terms", "/commission-policy", "/payment-policy",
  "/solar-calculator", "/estimate", "/book-a-call", "/associates/apply/associate", "/associates/apply/preferred",
];
// Pages with long text get checked in Hindi and Bengali too.
const LONG_TEXT = ["", "/services", "/careers", "/solar-calculator", "/associates/apply/associate"];

const PORTAL = ["", "/customers", "/customers/new", "/earnings", "/help", "/id-card", "/profile", "/referrals"];

const DASHBOARD = [
  "", "/accounts", "/agents", "/analytics", "/archive", "/archive/import", "/associate-network",
  "/associate-network/associates", "/associate-network/territories", "/attribution-flags", "/audit-log",
  "/commissions", "/commissions/payouts", "/commissions/queries", "/commissions/rates", "/data-checklist",
  "/employees", "/equipment", "/leads", "/leads/1", "/meetings", "/network", "/nova", "/onboardings",
  "/operations", "/price-list", "/proposals", "/service-requests", "/site-assessments",
  "/survey-corrections", "/survey-reviews",
  // FE-17
  "/approvals", "/access", "/access/alerts", "/two-step",
];

// FE-17: the invitation sign-up pages, reached signed out from the email link (an expired
// ticket shows the page's own message), and the menus of the two-step and Network Manager roles.
const FE17: PageCase[] = [
  { path: "/dashboard/sign-up?__clerk_ticket=tok-expired", principal: null },
  ...["", "/hi", "/bn"].map((l) => ({ path: `${l}/associates/sign-up?__clerk_ticket=tok-expired`, principal: null })),
  { path: "/dashboard/employees", principal: "staff:network_manager", label: "/dashboard/employees as network manager" },
  { path: "/dashboard", principal: "staff:uninvited", label: "/dashboard not invited" },
];

// FE-18: the Proposal Studio as the Proposal Desk (and the approver's review as Management),
// the customer's online proposal and the verification page. Ids, the token and the code come
// from the seeded backend (tests/visual/seed-studio.mjs prints them); override when yours differ.
const STUDIO_DRAFT = process.env.VISUAL_STUDIO_DRAFT_ID ?? "2";
const STUDIO_ISSUED = process.env.VISUAL_STUDIO_ISSUED_ID ?? "1";
const STUDIO_PENDING = process.env.VISUAL_STUDIO_PENDING_ID ?? "3";
const STUDIO_CUSTOMER = process.env.VISUAL_STUDIO_CUSTOMER_ID ?? "1";
const STUDIO_TOKEN = process.env.VISUAL_STUDIO_TOKEN ?? "tok-unknown";
const STUDIO_CODE = process.env.VISUAL_STUDIO_CODE ?? "UNKNOWNCODE1";
const DESK = "staff:proposal_desk" as const;
const FE18: PageCase[] = [
  ...["", "/new", "/proposals", "/customers", `/customers/${STUDIO_CUSTOMER}`, "/library", "/import",
    `/proposals/${STUDIO_DRAFT}?step=project`, `/proposals/${STUDIO_DRAFT}?step=price`, `/proposals/${STUDIO_DRAFT}?step=review`,
    `/proposals/${STUDIO_ISSUED}?view=overview`].map((p) => ({ path: `/dashboard/studio${p}`, principal: DESK })),
  { path: `/dashboard/studio/proposals/${STUDIO_PENDING}/review`, principal: "staff:management", label: "/dashboard/studio/proposals/review as management" },
  { path: "/dashboard", principal: "staff:sales+proposal_desk", label: "/dashboard as sales + proposal desk" },
  { path: `/proposal/${STUDIO_TOKEN}`, principal: null, label: "/proposal/[token]" },
  { path: "/proposal/tok-unknown", principal: null, label: "/proposal/[token] unknown" },
  ...["", "/hi", "/bn"].map((l) => ({ path: `${l}/verify/p/${STUDIO_CODE}`, principal: null, label: `${l}/verify/p/[code]` })),
  { path: "/verify/p/UNKNOWNCODE1", principal: null, label: "/verify/p/[code] unknown" },
];

/** Associate ids in the seeded backend (tests/visual/README.md); override when yours differ. */
const ASSOCIATE = process.env.VISUAL_ASSOCIATE_ID ?? "GNA-WB-26-90001";
const PREFERRED = process.env.VISUAL_PREFERRED_ID ?? "GNA-WB-26-90002";

export const PAGES: PageCase[] = [
  // English is canonical without a prefix (/en/… redirects there).
  ...PUBLIC.map((p) => ({ path: p || "/", principal: null })),
  ...["hi", "bn"].flatMap((l) => LONG_TEXT.map((p) => ({ path: `/${l}${p}`, principal: null }))),
  ...PORTAL.map((p) => ({ path: `/associates/portal${p}`, principal: `associate:${ASSOCIATE}` as const })),
  ...[...PORTAL, "/territory"].map((p) => ({ path: `/preferred/portal${p}`, principal: `associate:${PREFERRED}` as const })),
  { path: "/proposal/accept/tok-ready", principal: null },
  { path: "/proposal/accept/tok-expired", principal: null },
  ...DASHBOARD.map((p) => ({ path: `/dashboard${p}`, principal: "staff:admin" as const })),
  ...FE17,
  ...FE18,
];

export const caseName = (c: PageCase) => c.label ?? c.path;
export const slug = (path: string) => path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_") || "root";

/**
 * Sign the stub in and send the stub API host to the real backend, swapping
 * the stub token for the backend's development-only identity headers.
 */
export async function prepare(page: Page, principal: Principal): Promise<void> {
  if (principal) {
    await page.context().addCookies([{ name: "vm_principal", value: principal, url: VISUAL_ORIGIN }]);
  }
  await page.route(`${VISUAL_API}/**`, async (route) => {
    const req = route.request();
    if (principal === "staff:uninvited") {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        headers: { "access-control-allow-origin": VISUAL_ORIGIN, "access-control-allow-headers": "*" },
        body: JSON.stringify({ detail: { code: "not_invited", message: "You have not been invited to the Grid Nova dashboard." } }),
      });
      return;
    }
    const headers = { ...req.headers() };
    delete headers.authorization;
    if (principal?.startsWith("staff:")) {
      const roles = principal.slice(6).split("+");
      headers["x-employee-id"] = `visual-${roles.join("-")}`;
      headers["x-employee-role"] = roles[0];
      if (roles.length > 1) headers["x-employee-roles"] = roles.join(",");
    } else if (principal?.startsWith("associate:")) {
      headers["x-associate-id"] = principal.slice(10);
    }
    try {
      const res = await route.fetch({ url: req.url().replace(VISUAL_API, VISUAL_BACKEND), headers });
      await route.fulfill({ response: res });
    } catch {
      await route.abort("connectionrefused");
    }
  });
}

export interface Finding {
  kind: "overflow" | "collapsed" | "unreachable" | "overlap" | "covered-fixed" | "teaser-covers" | "launcher-covers" | "small-target" | "distorted-image" | "upscaled-image";
  detail: string;
}

/**
 * Measures the loaded page in the browser. Overflow and overlap are the
 * assertions; the rest are reported for review.
 */
export function measure(): { scrollWidth: number; innerWidth: number; findings: Finding[] } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const findings: Finding[] = [];
  const name = (el: Element) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };
  const visible = (el: Element) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    if (el.closest("[aria-hidden='true'], [inert]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  // Clipped by an ancestor other than <html>/<body>: a scroller or a deliberate crop.
  const clippedByAncestor = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX !== "visible" || s.clipPath !== "none" || s.contain.includes("paint")) return true;
    }
    return false;
  };

  // 1. Horizontal overflow — the page and any element sticking out of the
  // viewport (body has overflow-x: clip, so scrollWidth alone cannot see it).
  const all = Array.from(document.body.querySelectorAll("*"));
  const sticking = all.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1 && r.left >= -1) return false;
    if (!visible(el) || clippedByAncestor(el)) return false;
    const s = getComputedStyle(el);
    // Off-canvas panels moved out with a transform are closed, not overflowing.
    if (s.position === "fixed" && s.transform !== "none") return false;
    return true;
  });
  // Report only the outermost offenders, not every descendant.
  for (const el of sticking) {
    if (sticking.some((o) => o !== el && o.contains(el))) continue;
    const r = el.getBoundingClientRect();
    findings.push({ kind: "overflow", detail: `${name(el)} spans ${Math.round(r.left)}…${Math.round(r.right)} of ${vw}` });
  }

  // 2. Fixed / sticky elements covering a control on load.
  const fixed = all.filter((el) => {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "sticky") return false;
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width * r.height < vw * vh * 0.6; // not a backdrop or a full-screen layer
  });
  const controls = Array.from(
    document.querySelectorAll("input:not([type=hidden]), select, textarea, button, a[href], [role=button], [contenteditable=true]"),
  ).filter((el) => visible(el) && !fixed.some((f) => f.contains(el)));
  for (const f of fixed) {
    const fr = f.getBoundingClientRect();
    // Content scrolling under a sticky/fixed top bar is normal once the page has scrolled
    // (an autofocused field can scroll it on load).
    if (window.scrollY > 0 && fr.top <= 0 && fr.width >= vw * 0.9) continue;
    for (const c of controls) {
      if (c.contains(f)) continue;
      const cr = c.getBoundingClientRect();
      const x1 = Math.max(fr.left, cr.left), x2 = Math.min(fr.right, cr.right);
      const y1 = Math.max(fr.top, cr.top, 0), y2 = Math.min(fr.bottom, cr.bottom, vh);
      if (x2 - x1 < 4 || y2 - y1 < 4) continue;
      const top = document.elementFromPoint((x1 + x2) / 2, (y1 + y2) / 2);
      if (top && f.contains(top) && !c.contains(top)) {
        // The Ask Nova teaser bubble must never sit on a form field or a form's button
        // (it fails); over a link it is reported. The round launcher is a floating action
        // button that content scrolls out from under, so it is reported, not failed.
        const field = c.matches("input, select, textarea, [contenteditable=true]") || (c.tagName === "BUTTON" && !!c.closest("form"));
        const teaser = top.closest(".nova-teaser");
        const launcher = !teaser && !!top.closest("[data-floating-launcher]");
        const kind = teaser ? (field ? "overlap" : "teaser-covers") : launcher ? "launcher-covers" : "overlap";
        findings.push({ kind, detail: `${name(teaser ?? f)} covers ${name(c)}` });
      }
    }
    // And the reverse: a fixed header/footer control must not be covered by page content.
    for (const c of Array.from(f.querySelectorAll("a[href], button, input, select, textarea"))) {
      if (!visible(c)) continue;
      const r = c.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > vw || y > vh) continue;
      const top = document.elementFromPoint(x, y);
      if (top && !c.contains(top) && !f.contains(top) && !top.closest("[role=dialog], [data-floating-launcher]")) {
        findings.push({ kind: "covered-fixed", detail: `${name(c)} in fixed ${name(f).split(" ")[0]} is covered by ${name(top)}` });
      }
    }
  }

  // 2b. Controls inside a fixed panel (a sidebar, a drawer) that sit below the
  // screen with nothing to scroll them into view can never be reached.
  for (const f of all.filter((el) => getComputedStyle(el).position === "fixed" && visible(el))) {
    for (const c of Array.from(f.querySelectorAll("a[href], button, input, select, textarea"))) {
      const r = c.getBoundingClientRect();
      if (r.height < 2 || r.top < vh - 1) continue;
      let scroller = false;
      for (let p = c.parentElement; p && p !== f.parentElement; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) { scroller = true; break; }
      }
      if (!scroller) findings.push({ kind: "unreachable", detail: `${name(c)} at y=${Math.round(r.top)} in fixed ${name(f).split(" ")[0]} (screen ${vh})` });
    }
  }

  // 2b'. The dashboard menu shows the current page's item without scrolling.
  const menu = document.querySelector<HTMLElement>("aside [data-testid=sidebar-scroll]");
  const current = menu?.querySelector<HTMLElement>("[aria-current=page]");
  if (menu && current && visible(menu)) {
    const m = menu.getBoundingClientRect(), a = current.getBoundingClientRect();
    if (a.top < m.top - 1 || a.bottom > m.bottom + 1) findings.push({ kind: "unreachable", detail: `current menu item ${name(current)} is outside the visible menu (${Math.round(a.top)}–${Math.round(a.bottom)} vs ${Math.round(m.top)}–${Math.round(m.bottom)})` });
  }

  // 2c. Form controls squeezed to (almost) nothing by their flex/grid row.
  for (const c of Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea, button"))) {
    const s = getComputedStyle(c);
    if (s.display === "none" || s.visibility === "hidden" || c.closest("[aria-hidden='true'], [inert], .sr-only")) continue;
    const r = c.getBoundingClientRect();
    if (r.height > 4 && r.width < 6 && Number(s.opacity) > 0) findings.push({ kind: "collapsed", detail: `${name(c)} is ${Math.round(r.width)} px wide` });
  }

  // 3. Tap targets under 44 px on touch-size screens (text links inside a sentence are exempt).
  if (vw <= 1024) {
    for (const c of controls) {
      const r = c.getBoundingClientRect();
      if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
      if (c.tagName === "A" && getComputedStyle(c).display === "inline" && c.parentElement?.closest("p, li")) continue;
      if (r.width < 44 || r.height < 44) {
        if (c.matches("input[type=checkbox], input[type=radio]") && c.closest("label")) continue;
        findings.push({ kind: "small-target", detail: `${name(c)} ${Math.round(r.width)}×${Math.round(r.height)}` });
      }
    }
  }

  // 4. Images: stretched out of their own shape, or drawn bigger than the file (blurry).
  for (const img of Array.from(document.images)) {
    if (!img.complete || !img.naturalWidth || !visible(img)) continue;
    const r = img.getBoundingClientRect();
    const fit = getComputedStyle(img).objectFit;
    const natural = img.naturalWidth / img.naturalHeight;
    if ((fit === "fill" || fit === "") && Math.abs(r.width / r.height / natural - 1) > 0.03) {
      findings.push({ kind: "distorted-image", detail: `${img.currentSrc.split("?")[0].slice(-60)} drawn ${Math.round(r.width)}×${Math.round(r.height)}, file ${img.naturalWidth}×${img.naturalHeight}` });
    }
    if (img.currentSrc.endsWith(".svg")) continue;
    // With a srcset, naturalWidth is in CSS pixels; the file's real width is the
    // optimizer's `w` (the source may be smaller still, so this can only under-report).
    const w = /[?&]w=(\d+)/.exec(img.currentSrc);
    const fileW = w ? Number(w[1]) : img.naturalWidth;
    const fileH = fileW / natural;
    const scale = fit === "cover" ? Math.max(r.width / fileW, r.height / fileH)
      : fit === "contain" ? Math.min(r.width / fileW, r.height / fileH)
      : r.width / fileW;
    if (scale * devicePixelRatio > 1.25 && r.width >= 120) {
      findings.push({ kind: "upscaled-image", detail: `${decodeURIComponent(img.currentSrc).replace(/^.*url=/, "").split("&")[0].slice(-60)} ×${(scale * devicePixelRatio).toFixed(2)} (drawn ${Math.round(r.width)}px)` });
    }
  }

  return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, findings };
}
