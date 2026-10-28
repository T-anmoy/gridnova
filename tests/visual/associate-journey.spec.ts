import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import https from "node:https";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { VISUAL_API, VISUAL_BACKEND, VISUAL_ORIGIN } from "./matrix";

// FE-19: the associate journey end to end on a basic Android phone — 360 × 740, slow 4G —
// in English, Hindi and Bengali, against a local development backend (tests/visual/README.md):
// Careers → apply (with documents) → (mocked) approval → sign up from the invitation → portal →
// onboard a customer through every wizard step with documents, site photos, GPS and both
// signatures → indicative estimate → (staff prepares) the formal proposal → earnings.
// The staff side of the same journey is the last test.
//
// "Mocked" approval: the staff steps between the associate's own steps go through the staff
// API with the backend's development headers. Everything the associate does is the real UI.
//
// Uploads: Chromium does not hand file bytes to request interception, so the stub API host
// is mapped (host-resolver-rules) to a small TLS forwarder in front of the backend, and the
// route only adds the identity headers (route.continue keeps the body).
//
//   VISUAL_BACKEND=http://127.0.0.1:8000 npx playwright test -c playwright.visual.config.ts associate-journey --workers=1

const FORWARD_PORT = 8443;
const B = `${VISUAL_BACKEND}/api/v1`;
const STAFF = { "X-Employee-Id": "journey-admin", "X-Employee-Role": "admin" } as const;
const LANGS = ["en", "hi", "bn"] as const;
type Lang = (typeof LANGS)[number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages = (lang: Lang): any => JSON.parse(readFileSync(path.join(__dirname, `../../messages/${lang}.json`), "utf8"));
// A 1×1 JPEG and a minimal PDF: real files the backend accepts.
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

// One worker (the TLS forwarder owns one port); each test stands alone.
test.describe.configure({ mode: "default" });
test.use({
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 22.8765, longitude: 88.62, accuracy: 8 },
  permissions: ["geolocation"],
  ignoreHTTPSErrors: true,
  launchOptions: { args: [`--host-resolver-rules=MAP api.visual.test:443 127.0.0.1:${FORWARD_PORT}`] },
});
// The whole journey on throttled slow 4G takes 8–10 minutes.
test.setTimeout(15 * 60_000);

let forwarder: https.Server | undefined;

test.beforeAll(async () => {
  const up = await fetch(`${B}/public/territories/states`).then((r) => r.ok).catch(() => false);
  test.skip(!up, `no development backend at ${VISUAL_BACKEND}`);
  const dir = mkdtempSync(path.join(tmpdir(), "journey-tls-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", `${dir}/key.pem`, "-out", `${dir}/cert.pem`, "-days", "1", "-subj", "/CN=api.visual.test"], { stdio: "ignore" });
  const backend = new URL(VISUAL_BACKEND);
  forwarder = https.createServer({ key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) }, (req, res) => {
    const upstream = http.request({ host: backend.hostname, port: backend.port, method: req.method, path: req.url, headers: { ...req.headers, host: backend.host } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => forwarder!.listen(FORWARD_PORT, "127.0.0.1", resolve));
});

test.afterAll(() => forwarder?.close());

/** Chrome DevTools "Slow 4G"-like: 150 ms round trip, 1.6 Mbps down, 750 kbps up (Lighthouse mobile). */
async function slow4g(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
}

/** Requests to the stub API host go out unmodified, with the development identity instead of the stub token. */
async function as(page: Page, identity: Record<string, string>) {
  await page.unrouteAll();
  await page.route(`${VISUAL_API}/**`, async (route) => {
    const headers = { ...route.request().headers(), ...identity };
    delete headers.authorization;
    await route.continue({ headers });
  });
}

const api = async (method: string, url: string, body?: unknown, headers: Record<string, string> = STAFF) => {
  const r = await fetch(`${B}${url}`, { method, headers: { ...headers, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

// Invented identities that pass the backend's checks: an Aadhaar with its Verhoeff digit, an individual's PAN.
const D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const INV = [0,4,3,2,1,5,6,7,8,9];
function identity(seed: number) {
  const base = ("2" + String(seed).padStart(10, "0")).slice(0, 11);
  let c = 0;
  base.split("").reverse().map(Number).forEach((d, i) => (c = D[c][P[(i + 1) % 8][d]]));
  const L = "ABCDEFGHJKLMNPRSTUVWXYZ";
  return {
    aadhaar: base + INV[c],
    pan: `AB${L[seed % 23]}P${L[Math.floor(seed / 23) % 23]}${String(1000 + (seed % 9000))}K`,
    mobile: `9${String(700000000 + (seed % 199999999)).padStart(9, "0")}`,
    customerMobile: `98${String(20000000 + (seed % 9999999)).slice(-8)}`,
    consumer: `1${String(seed % 99999999).padStart(8, "0")}`,
    bank: `5${String(seed).padStart(11, "0")}`,
  };
}

const shots = (lang: string) => {
  let n = 0;
  return (page: Page, name: string) => page.screenshot({ path: `test-results/associate-journey/${lang}/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });
};

for (const lang of LANGS) {
  test(`associate journey at 360×740 on slow 4G (${lang})`, async ({ page, context }) => {
    const m = messages(lang);
    const t = m.associates;
    const W = t.portal.wizard;
    const SV = m.survey;
    const prefix = lang === "en" ? "" : `/${lang}`;
    const shot = shots(lang);
    const seed = (Date.now() % 9_000_000) + LANGS.indexOf(lang) * 13;
    const id = identity(seed);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text()));
    await slow4g(page);
    await as(page, {});

    // 1. Careers → the application form.
    await page.goto(`${VISUAL_ORIGIN}${prefix}/careers`);
    await page.getByRole("link", { name: m.careers.join.applyAssociate }).first().click();
    await page.waitForURL(/apply\/associate/);
    const f = t.wizard.fields;
    const next = () => page.getByRole("button", { name: t.wizard.common.next }).click();
    await page.getByLabel(f.full_name.label, { exact: true }).fill(`Journey ${lang.toUpperCase()} Applicant`);
    // The date field's label names its day box; typing the digits fills day, month and year.
    await page.getByLabel(f.date_of_birth.label, { exact: true }).first().pressSequentially("14051990");
    await page.getByLabel(f.mobile.label, { exact: true }).fill(id.mobile);
    await page.getByLabel(f.email.label, { exact: true }).fill(`journey.${lang}.${seed}@example.in`);
    await shot(page, "apply-personal");
    await next();
    await page.getByLabel(f.address_line.label, { exact: true }).fill("12 Example Lane, Habra");
    const pick = async (label: string, re: RegExp) => {
      const el = page.getByLabel(label, { exact: true });
      await expect(el.locator("option", { hasText: re })).toHaveCount(1);
      await el.selectOption({ label: (await el.locator("option", { hasText: re }).textContent())! });
    };
    await pick(t.wizard.common.stateLabel, /WEST BENGAL/i);
    await pick(t.wizard.common.districtLabel, /PARAGANAS NORTH/i);
    const block = page.getByLabel(t.wizard.common.blockLabel, { exact: true });
    if (await block.isEnabled()) await block.selectOption({ index: 1 });
    await page.getByLabel(f.pin_code.label, { exact: true }).fill("743263");
    await next();
    await page.getByLabel(f.aadhaar_number.label, { exact: true }).fill(id.aadhaar);
    await page.getByLabel(f.pan.label, { exact: true }).fill(id.pan);
    await page.getByLabel(f.bank_account_number.label, { exact: true }).fill(id.bank);
    await page.getByLabel(f.bank_ifsc.label, { exact: true }).fill("HDFC0001234");
    await next();
    await page.getByRole("radio", { name: t.wizard.associate.capabilitySales }).check();
    await next();
    for (const input of await page.locator('main input[type="file"]').all()) {
      await input.setInputFiles({ name: "document.jpg", mimeType: "image/jpeg", buffer: JPEG });
    }
    await shot(page, "apply-documents");
    await next();
    await page.getByRole("checkbox", { name: t.consent.acceptLabel }).check();
    await next();
    await page.getByRole("button", { name: t.wizard.common.submit }).click();
    await expect(page.getByRole("heading", { name: t.wizard.associate.success.title })).toBeVisible({ timeout: 60_000 });
    await shot(page, "apply-submitted");
    const applicationId = Number((await page.getByText(/^#\d+$/).textContent())!.slice(1));

    // 2. (Mocked) approval by Grid Nova staff.
    await api("POST", `/dashboard/associate-applications/associate/${applicationId}/status`, { status: "under_review" });
    const approved = await api("POST", `/dashboard/associate-applications/associate/${applicationId}/approve`, { verification_call_completed: true, verification_call_note: "Journey test: identity confirmed on the call." });
    const associateId: string = approved.associate_id ?? approved.associate?.associate_id;
    expect(associateId).toMatch(/^GNA-/);

    // 3. The invitation link opens the sign-up page in the reader's language.
    await page.goto(`${VISUAL_ORIGIN}${prefix}/associates/sign-up?__clerk_ticket=tok-journey`);
    await expect(page.getByRole("heading", { name: t.signUp.title })).toBeVisible();
    await shot(page, "sign-up");

    // 4. Signed in: the portal.
    await context.addCookies([{ name: "vm_principal", value: `associate:${associateId}`, url: VISUAL_ORIGIN }]);
    await as(page, { "x-associate-id": associateId });
    await page.goto(`${VISUAL_ORIGIN}${prefix}/associates/portal`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByTestId("portal-error")).toHaveCount(0);
    await shot(page, "portal-home");

    // 5. Onboard a customer, every step through the UI.
    await page.goto(`${VISUAL_ORIGIN}${prefix}/associates/portal/customers/new`);
    const cont = async () => {
      await page.getByRole("button", { name: W.continueButton, exact: true }).click();
      await page.waitForTimeout(1200);
    };
    const choose = async (label: string, index = 1) => page.getByLabel(label, { exact: true }).selectOption({ index });
    const fillSelects = async () => {
      for (const el of await page.locator("main select:enabled").all()) if (!(await el.inputValue())) await el.selectOption({ index: 1 }).catch(() => {});
    };
    await expect(page.getByTestId("notice-version")).toContainText("approved-v1");
    await page.getByRole("checkbox").first().check();
    await shot(page, "wizard-notice");
    await cont();
    await page.getByLabel(W.customer.nameLabel).fill("Ramesh Mondal");
    await page.getByLabel(W.customer.mobileLabel).fill(id.customerMobile);
    await page.getByLabel(W.customer.customerTypeLabel).selectOption("individual");
    await page.getByLabel(W.customer.fullAddressLabel).fill("Village Example, Habra, North 24 Parganas");
    await page.getByLabel(W.customer.pinCodeLabel).fill("743263");
    await cont();
    await pick(W.connection.stateLabel, /WEST BENGAL/i);
    await pick(W.connection.districtLabel, /PARAGANAS NORTH/i);
    if (await page.getByLabel(W.connection.blockLabel, { exact: true }).isEnabled()) await choose(W.connection.blockLabel);
    await choose(W.connection.connectionInCustomerNameLabel);
    await choose(W.connection.siteTypeLabel);
    await choose(W.connection.connectionTypeLabel);
    await pick(SV.connection.discomLabel, /WBSEDCL/);
    await page.getByLabel(SV.connection.consumerNumberLabel).fill(id.consumer);
    await choose(SV.connection.phaseLabel);
    await page.getByLabel(SV.connection.sanctionedLoadLabel).fill("4");
    await cont();
    const units = page.getByLabel(SV.bills.unitsLabel, { exact: true });
    for (let i = 0; i < (await units.count()); i++) await units.nth(i).fill(String(320 + i * 10));
    await shot(page, "wizard-bills");
    await cont();
    await choose(W.property.propertyInCustomerNameLabel);
    await choose(W.property.customerTimelineLabel);
    await cont();
    await page.getByRole("group", { name: W.requirement.title }).getByRole("button").first().click();
    await page.getByLabel(new RegExp(W.requirement.desiredKwLabel.replace(/[()]/g, "\\$&"))).fill("3");
    await cont();
    await page.getByRole("button", { name: m.siteLocation.actions.captureHere }).click();
    await page.waitForTimeout(4000);
    const save = page.getByRole("button", { name: m.siteLocation.actions.save });
    if (await save.count()) await save.click();
    await page.getByRole("button", { name: m.siteLocation.actions.confirm }).click();
    await expect(page.getByText(m.siteLocation.state.confirmedVerified)).toBeVisible({ timeout: 30_000 });
    const R = SV.roof;
    await fillSelects();
    await page.getByRole("checkbox", { name: R.obstaclesNone, exact: true }).check();
    await page.getByLabel(R.floorsLabel).fill("2");
    await page.getByLabel(R.roofAreaLabel).fill("900");
    await page.getByRole("radio", { name: R.modeDirect }).check();
    await page.getByLabel(R.shadowFreeLabel).fill("600");
    await fillSelects();
    for (const l of [R.roofsAvailableLabel, R.roofsConsideredLabel]) {
      const el = page.getByLabel(l);
      if (await el.count()) {
        if ((await el.evaluate((e) => e.tagName)) === "SELECT") await el.selectOption({ index: 1 });
        else await el.fill("1");
      }
    }
    await shot(page, "wizard-house");
    await cont();
    await fillSelects();
    await page.getByLabel(SV.layout.panelToInverterLabel).fill("12");
    await page.getByLabel(SV.layout.inverterToLtLabel).fill("8");
    await cont();
    for (const input of await page.locator('main input[type="file"]').all()) {
      await input.setInputFiles({ name: "document.pdf", mimeType: "application/pdf", buffer: PDF });
      await page.waitForTimeout(800);
    }
    await expect(page.getByText(/scheme_linked|not_in_customer_name/)).toHaveCount(0);
    await shot(page, "wizard-documents");
    await cont();
    // Site photos, taken with the camera input (the phone's camera on a real device).
    const cameras = page.locator('main [data-testid="camera-input"]');
    expect(await cameras.count()).toBeGreaterThan(0);
    for (const cam of await cameras.all()) {
      await cam.setInputFiles({ name: "site.jpg", mimeType: "image/jpeg", buffer: JPEG });
      await page.waitForTimeout(1500);
    }
    await shot(page, "wizard-photos");
    await cont();
    const G = SV.signatures;
    const draw = async (canvas: ReturnType<Page["locator"]>) => {
      await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * ((box.width - 40) / 12), box.y + box.height / 2 + (i % 2 ? 15 : -15));
      await page.mouse.up();
    };
    await page.getByLabel(G.declarationNameLabel).fill("Ramesh Mondal");
    await page.getByLabel(G.confirmLabel).check();
    await draw(page.locator("main canvas").first());
    await page.getByRole("button", { name: G.signCustomer }).click();
    await page.waitForTimeout(2000);
    await draw(page.locator("main canvas").last());
    await page.getByRole("button", { name: G.signAssociate }).click();
    await page.waitForTimeout(2000);
    await shot(page, "wizard-signed");
    await cont();
    // On slow 4G the photos may still be on their way: Submit waits for them.
    const submit = page.getByRole("button", { name: W.review.submitButton });
    await expect(submit).toBeEnabled({ timeout: 120_000 });
    await shot(page, "wizard-review");
    await submit.click();
    await page.waitForURL(/\/customers\/\d+$/, { timeout: 60_000 }).catch(async (e) => {
      await shot(page, "wizard-submit-refused");
      throw new Error(`submit did not open the customer: ${await page.locator("main [role=alert]").allInnerTexts()} — ${e.message}`);
    });
    const onboardingId = Number(page.url().match(/customers\/(\d+)/)![1]);
    await shot(page, "customer-page");

    // 6. An indicative estimate.
    const E = t.portal.estimate;
    await page.getByRole("button", { name: E.getEstimateButton }).first().click();
    await page.getByLabel(E.fields.segmentLabel).fill("residential");
    await page.getByRole("button", { name: E.getEstimateButton }).last().click();
    await expect(page.getByText(E.history.empty)).toHaveCount(0, { timeout: 60_000 });
    await shot(page, "estimate");

    // 7. Grid Nova verifies, reviews the survey and approves the assessment; the associate
    // requests the formal proposal in the portal; staff prepare it; the associate sees it.
    await api("POST", `/dashboard/onboardings/${onboardingId}/verification-call`, { verification_call_completed: true, note: "Customer confirmed." });
    await api("POST", `/dashboard/onboardings/${onboardingId}/survey/review`, { outcome: "feasible", notes: "Journey test." });
    const leadInputs = await api("GET", `/proposal-inputs/?lead_id=${(await api("GET", `/dashboard/onboardings/${onboardingId}`)).lead_id}`);
    await api("PATCH", `/proposal-inputs/${leadInputs.items[0].id}/review`, { status: "approved_for_proposal" });
    await page.reload();
    await page.getByRole("button", { name: t.portal.proposal.requestButton }).click();
    await expect(page.getByText(t.portal.proposal.requestedNote)).toBeVisible({ timeout: 30_000 });
    const prepared = await api("POST", `/dashboard/onboardings/${onboardingId}/formal-proposal`, { customer_email: `ramesh.${seed}@example.in` }).catch((e: Error) => e);
    await page.reload();
    if (!(prepared instanceof Error)) await expect(page.getByText(t.portal.proposal.detail.preparedTitle, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await shot(page, "proposal");
    test.info().annotations.push({ type: "formal proposal", description: prepared instanceof Error ? `not prepared: ${prepared.message}` : "prepared and shown" });

    // 8. Earnings: the page loads, in the reader's language, without an error card.
    await page.goto(`${VISUAL_ORIGIN}${prefix}/associates/portal/earnings`);
    await expect(page.getByRole("heading", { name: t.portal.earnings.title })).toBeVisible();
    await expect(page.getByTestId("portal-error")).toHaveCount(0);
    await shot(page, "earnings");

    // No horizontal scrolling anywhere on the way, and no console errors from the app.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });
}

test("staff side: review, approve, suspend with its result, and move customers", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const seed = (Date.now() % 9_000_000) + 77;
  const id = identity(seed);
  // An application submitted through the public API (the associate's side is above).
  const consent = await api("GET", "/public/kyc-consent", undefined, {});
  const districts = await api("GET", "/public/territories/states/19/districts", undefined, {});
  const district = districts.items.find((x: { name: string }) => /PARAGANAS NORTH/i.test(x.name));
  const blocks = district.has_blocks ? await api("GET", `/public/territories/districts/${district.lgd_code}/blocks`, undefined, {}) : null;
  const fd = new FormData();
  const fields: Record<string, string> = {
    full_name: "Staff Side Applicant", date_of_birth: "1990-05-14", mobile: id.mobile, email: `staff.${seed}@example.in`, address_line: "12 Example Lane, Habra",
    state_lgd_code: "19", district_lgd_code: String(district.lgd_code), pin_code: "743263", aadhaar_number: id.aadhaar, pan: id.pan,
    bank_account_number: id.bank, bank_ifsc: "HDFC0001234", kyc_consent_version: consent.version, kyc_consent_accepted: "true", capability: "sales",
  };
  if (blocks) fields.block_lgd_code = String(blocks.items[0].lgd_code);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const k of ["masked_aadhaar", "pan_card", "photo", "cancelled_cheque"]) fd.set(k, new Blob([JPEG], { type: "image/jpeg" }), `${k}.jpg`);
  const applied = await (await fetch(`${B}/public/associates/apply`, { method: "POST", body: fd })).json();

  await context.addCookies([{ name: "vm_principal", value: "staff:admin", url: VISUAL_ORIGIN }]);
  await as(page, { "x-employee-id": "journey-admin", "x-employee-role": "admin" });
  await page.goto(`${VISUAL_ORIGIN}/dashboard/associate-network/associate/${applied.application_id}`);
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByLabel("Reason — shown to the applicant")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("checkbox", { name: "Verification call completed" }).check();
  await page.getByLabel("Call notes").fill("Identity confirmed on the call.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("approved-notice")).toBeVisible({ timeout: 30_000 });
  const detail = await api("GET", `/dashboard/associate-applications/associate/${applied.application_id}`);
  await page.goto(`${VISUAL_ORIGIN}/dashboard/associate-network/associates/${detail.associate_id}`);
  await expect(page.getByTestId("invite-state")).toBeVisible();
  await page.getByRole("button", { name: "Suspend" }).click();
  await page.getByLabel("Reason for suspension").fill("Journey test suspension");
  await page.getByRole("button", { name: "Confirm suspend" }).click();
  await expect(page.getByTestId("status-result")).toBeVisible();
  await expect(page.getByTestId("commission-frozen")).toBeVisible();
  await page.screenshot({ path: "test-results/associate-journey/staff/01-suspended.png", fullPage: true });
  await page.getByTestId("move-customers-card").getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Move customers" })).toBeVisible();
  await page.screenshot({ path: "test-results/associate-journey/staff/02-move-customers.png", fullPage: true });
  // With no open customers the server says so in plain words.
  const target = page.getByRole("radio").first();
  if (await target.count()) {
    await target.check();
    await page.getByLabel("Reason (required)").fill("Journey test");
    await page.getByRole("button", { name: /Move every open customer/ }).click();
    await expect(page.getByTestId("move-error")).toContainText("no open customers");
  }
});
