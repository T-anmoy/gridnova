# FE-22b — Close the small gaps left after FE-22

Built on `main` at `f5e3e97` (FE-22). The tree was clean and level with `origin/main` before starting. **Not committed or pushed.**

Baseline (FE-22 at `f5e3e97`): `tsc --noEmit` and `eslint` clean, `next build` passes, 3132 unit tests pass.

## The six items

| # | Item | Result |
|---|---|---|
| 1 | In-person acceptance, staff and associate | **Added** for staff; **partly done already** for associates (see below) |
| 2 | Reminder for Admins, nav badge, rename to Launch readiness | **Added** |
| 3 | Follow-up hints after approving P6 / HW-OM / ONB-5 | **Added** |
| 4 | Who sees what for held receipts and O&M terms | Associates' receipt: **already done**. Accounts' receipt sentence and O&M terms: **added** |
| 5 | `.env.example` safety test + README line | **Added** |
| 6 | Hindi / Bengali review table | **Below** (no strings changed) |

### 1. In-person acceptance

- **Staff (added).** `app/(internal)/dashboard/onboardings/[id]/page.tsx`, with the sentences in the new `lib/dashboard/launch-wording.ts`. A 409 caused by the proposal's content is no longer a toast showing the backend's English. It is a message that stays in the acceptance form:
  - `unapproved_sections`: "This proposal can't be handed over yet. The wording for Terms and conditions (PRO-2) and … is waiting for an Admin's approval." Section ids are turned into names; "Open Launch readiness" is linked when the user holds `placeholders.view`.
  - `manual_review_required`: "This proposal needs a staff check before it goes out."
  - `placeholder_content` with no total: "Price to be set by Grid Nova." The in-person route sends no `missing_total_value` (backend `app/onboarding/formal.py` passes only `missing` and `unapproved_sections`), so the proposal's own `total_value` decides.
  - The formal-proposal card now shows "Price to be set by Grid Nova" instead of hiding the total.
- **Associates (already done in FE-22).** The portal's `unapproved_sections` and `manual_review_required` sentences are at `messages/en.json:2315-2316` (and in hi / bn), and are used through `portalErrorText` at `components/associate/OnboardingDetail.tsx:88`. Their wording differs slightly from the prompt ("Grid Nova is still finalising the wording of this proposal. It can be accepted once that is done — please ask your Grid Nova contact."). The meaning is the same, and item 6 says not to change the hi / bn strings, so they were kept.
- **Associates (added).** `placeholder_content` with no total → "Price to be set by Grid Nova." (new key `acceptance.errors.price_to_be_set`, in en / hi / bn).

### 2. Reminder for Admins

- `components/dashboard/WordingReminder.tsx` (new), placed on the dashboard home (`app/(internal)/dashboard/page.tsx`).
  - Shown only to `placeholders.resolve`, and only while an `approved_text` entry is not `approved`. Lapsed counts as waiting.
  - Text: "{n} wordings are waiting for your approval" (singular for one), linking to `/dashboard/data-checklist`.
  - Nothing is fetched for anyone else. `usePlaceholders` gained an `enabled` option.
- **Nav badge:** `lib/dashboard/nav.ts` gains a `wording` flag, and `app/(internal)/dashboard/layout.tsx` shows the count on "Launch readiness" to everyone with `placeholders.view` (Admin and Management). It disappears at zero. The count helper tolerates a malformed body, so the sidebar can never crash on it.
- **Rename:** "Data checklist" → **Launch readiness** everywhere it is shown: page title, nav label, and the links on the proposal, onboarding and handover screens. The route stays `/dashboard/data-checklist`.

### 3. Follow-up hints

`lib/dashboard/placeholders.ts` (`APPROVAL_FOLLOW_UP`, `approvalNotice`) and the checklist page. After a successful approval a green notice reads "{ID} approved." plus, for:

- **P6**: "Receipts that were waiting can now be released: Accounts → Receipts → Release held receipts."
- **HW-OM**: "Handover packs that were waiting go out when staff send the handover link again."
- **ONB-5**: "Agreements printed from older wording must be generated again."

### 4. Who sees what

- **Accounts (added):** a held receipt reads "Held until the receipt wording is approved." (`lib/dashboard/payment-ui.ts`, used on the receipts list and the payment page).
- **Associates (already done):** a held receipt shows only "Receipt is being prepared". See `components/associate/PortalPayments.tsx:210` and `messages/en.json:2666`. Wording is never mentioned.
- **Customers:** there is no receipt page in this repo. Receipts reach customers only as a PDF link once released.
- **O&M terms after the free year, when `terms_after_free_period` is null (added):**
  - Customer handover page (`app/(internal)/handover/[token]/HandoverView.tsx`): "Details will be shared by Grid Nova." instead of "To be confirmed".
  - Portal (`components/associate/PortalHandover.tsx`): the same sentence, translated (new key `handover.warranty.omAfterPending`), instead of the "Not confirmed yet" chip.
  - Staff warranty panel: "Not shown until an Admin approves the O&M terms (HW-OM on Launch readiness)."

### 5. `.env.example`

`tests/unit/env-example.test.ts` (new, 9 tests).

- Every active `KEY=value` line must be empty. The exceptions are `NEXT_PUBLIC_API_URL=http://localhost:8000` and Clerk examples of the prefix plus only `x`.
- The whole file, comments included, fails on `sk_live_`, `pk_live_`, `re_` followed by 20 or more characters, or a standalone 43–44 character base64 run (standard or URL-safe). A row of `x` does not count.
- The detector's own cases are tested too.
- README: one line under the environment section.

## Hindi and Bengali for native review (not changed)

| Key | English | hi | bn |
|---|---|---|---|
| `associates.portal.proposal.acceptance.errors.unapproved_sections` | Grid Nova is still finalising the wording of this proposal. It can be accepted once that is done — please ask your Grid Nova contact. | Grid Nova अभी इस प्रस्ताव की भाषा को अंतिम रूप दे रहा है। यह पूरा होने के बाद इसे स्वीकार किया जा सकता है — कृपया अपने Grid Nova संपर्क से पूछें। | Grid Nova এখনও এই প্রস্তাবের ভাষা চূড়ান্ত করছে। তা শেষ হলে এটি গ্রহণ করা যাবে — অনুগ্রহ করে আপনার Grid Nova যোগাযোগকারীকে জিজ্ঞাসা করুন। |
| `associates.portal.proposal.acceptance.errors.manual_review_required` | Grid Nova needs to review this proposal before it can be accepted. Please ask your Grid Nova contact. | इस प्रस्ताव को स्वीकार करने से पहले Grid Nova को इसकी समीक्षा करनी है। कृपया अपने Grid Nova संपर्क से पूछें। | এই প্রস্তাবটি গ্রহণের আগে Grid Nova-কে এটি পর্যালোচনা করতে হবে। অনুগ্রহ করে আপনার Grid Nova যোগাযোগকারীকে জিজ্ঞাসা করুন। |
| `associates.portal.proposal.acceptance.errors.price_to_be_set` | Price to be set by Grid Nova. | कीमत Grid Nova तय करेगा। | দাম Grid Nova ঠিক করবে। |
| `associates.portal.agreement.updatingNote` | Grid Nova is updating the agreement. The download will appear here once it is ready. | Grid Nova समझौते को अपडेट कर रहा है। तैयार होते ही डाउनलोड यहाँ दिखेगा। | Grid Nova চুক্তিটি হালনাগাদ করছে। প্রস্তুত হলেই ডাউনলোড এখানে দেখা যাবে। |
| `associates.portal.agreement.uploadSigned.errors.agreement_wording_not_approved` | Grid Nova is updating the agreement. Please wait for the new copy before uploading the signed scan. | Grid Nova समझौते को अपडेट कर रहा है। हस्ताक्षरित स्कैन अपलोड करने से पहले कृपया नई प्रति का इंतज़ार करें। | Grid Nova চুক্তিটি হালনাগাদ করছে। স্বাক্ষরিত স্ক্যান আপলোড করার আগে অনুগ্রহ করে নতুন কপির জন্য অপেক্ষা করুন। |
| `associates.portal.handover.warranty.omAfterPending` | Details will be shared by Grid Nova. | विवरण Grid Nova साझा करेगा। | বিস্তারিত Grid Nova জানাবে। |

The first, second, fourth and fifth rows come from FE-22; the third and sixth are new in FE-22b.

## Checks

| Check | Before | After |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | clean | clean |
| `NEXT_PUBLIC_API_URL=https://api.gridnova.in npm run build` | passes | passes |
| `npx vitest run --maxWorkers=3` (run in 3 shards) | 3132 passed | **3161 passed, 0 failed** |

The 29 new tests are:

- `env-example.test.ts`: 9.
- `fe22b-gaps.test.tsx`: 14 (sentences, no raw codes, Admin-only reminder, gone when all nine are approved, hints, who sees what).
- Launch readiness badge in the real sidebar: 3 (Admin, Management, gone at zero).
- Staff in-person holds: 2.
- Approval notice on the page: 1.

Updated:

- Nav and test labels renamed to "Launch readiness".
- Two warranty tests now expect "Details will be shared by Grid Nova.".
- The staff O&M sentence and the receipt sentence.
- Three shell / home tests now mock the placeholders hook like the other data hooks.
