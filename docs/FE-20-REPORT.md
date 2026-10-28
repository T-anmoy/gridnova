# FE-20 — Direct-customer payments in the dashboard, plus the associate loose ends

Built on `main` (level with `origin/main`, 55ea54a) against the copied BE-20 contract: `docs/api/direct_payments.md`, `docs/api/associate_journeys.md` §9–12 and `openapi.json` (backend ee24910). **Not committed or pushed.**

## Phase 0

| # | Area | What the code did before FE-20 |
|---|---|---|
| 1 | BE-20 contract | Lead routes: `GET/POST /dashboard/leads/{id}/payments`, `GET …/payment-schedule`, `GET …/payments/{pid}/receipt`. Shared action routes (`/payments/{id}/verify\|deposit\|dishonour\|cancel\|proof\|receipt/resend`) unchanged. Who: Accounts and Admin record and act; Management and Sales (own or unassigned lead) read; others get 403. Errors: `not_accepted`, `no_accepted_total`, `invalid_amount`, `mode_not_enabled`, `reference_required`, `instrument_details_required`, `date_in_future`, `unknown_milestone`, `exceeds_outstanding` (with `outstanding`), `duplicate_payment_reference`, `self_verification`, `invalid_transition`. Receipts held while P6 is unsupplied. A lead brought by an associate answers `409 associate_customer {onboarding_id}`. Alerts link to `/dashboard/leads/{id}`. |
| 2 | Existing payment UI | `StaffPaymentsSection` (onboarding), `RecordPaymentForm` / `StaffRecordPayment`, and the action dialogs embedded in the Accounts payment page; payment JSON types in `lib/associate/payment-types.ts`. Reusable as they were: the form, `ProofUpload`, `ReasonDialog`, the status and attention labels, and the API hooks for the shared action routes. Not reusable as they were: the dialogs, which lived inside one page (now extracted to `PaymentActions`). |
| 3 | Where a direct payment (`lead_id` set, `onboarding_id` null) shows | The lead page had no payments, and no tabs. Accounts → Payments and Receipts: rendered (name from `customer_name`), but the row was untagged and there was no way back to the lead. Instalments: fell back to "Project N" with no link. Payment detail: the customer name showed as plain text. Work queues are counts only. **Nothing crashed.** Also found: **Accounts hold no `leads.view_*` permission**, so the lead page showed them "no access" (and `GET /leads/{id}` returns 403), yet BE-20's alert emails send Accounts to that page. |
| 4 | Associate screens | Move customers: moved every open customer (there was no list route). Duplicate customer: showed the generic save error. Site documents: the English `label` from `/options` was shown in every language, and the missing documents on the customer page showed raw codes. Photo slots were translated by key (FE-19). Estimate segment: a free-text box. |

## Screens changed

- **Lead → Payments tab** (`?tab=payments`; the button bar is Overview / Payments). Shows the customer and project code; totals (accepted total, verified, awaiting verification, balance); the schedule (label, percent, amount due, paid toward, outstanding, due chip, overdue flag with date); payments newest first (status, method, reference, bank, recorded by and when, verified by, payer, re-presented-from, dishonour or cancel reason, receipt state).
  - Before acceptance: "Payments start when the customer accepts the proposal."
  - Associate's lead (409): "brought by an associate" plus a link to `/dashboard/onboardings/{N}#payments`.
  - When every milestone is `paid` (the server's status), the form is replaced by "Fully paid".
- **Payments-only lead page for Accounts.** Accounts have no lead permission, so instead of "no access" they get "Lead #N — Payments" with just the tab. The lead detail is never requested for them.
- **Recording (Accounts, Admin)** uses the shared form, limited to `enabled_modes`, and every error code above has a plain sentence. `exceeds_outstanding` shows the outstanding amount, the accepted total and the amount already recorded, all from the server. "Record" means `payments.process`, not `payments.record`, because Sales hold `payments.record` for associate customers.
- **`PaymentActions`** (extracted, used by both the Accounts payment page and the tab): deposit, verify, dishonour, cancel, and proof upload when proof is missing.
  - Self-verification: when `recorded_by` is the signed-in person, the screen says "You recorded this payment, so another Accounts person must verify it." up front and disables Verify. An Admin gets the override, which requires a reason. A server `409 self_verification` is still handled.
- **Receipts:**
  - Held: "Receipt numbered GNR-… — held until Grid Nova approves the receipt wording; it will be sent automatically then."
  - Released: Download fetches a fresh signed `pdf_url` on each click; "Copy customer's link" copies `url`; Resend is for Accounts and Admin only.
  - A dishonoured payment's receipt shows as void.
- **Sales and Management** see the same tab read-only. Operations, Engineer and Network Manager get no tab, and no payment request is made for them.
- **Accounts workspace:**
  - Payments, Instalments and Receipts rows for a direct customer carry a "Direct" tag and an "Open lead" link to the Payments tab.
  - `?lead_id=N` narrows Payments and Receipts (with "Lead #N only · Show all").
  - The payment detail page links the customer to the lead.
  - Instalment row keys no longer collide between associate and direct milestones.
- **Move customers:** a tick list from `GET /associates/{id}/customers` showing client code, name, status and stage, with "Select all (n of m ticked)". With every customer ticked, `onboarding_ids` is omitted; otherwise only the ticked ids are sent. Sending with none ticked is refused.
- **Duplicate customer** (`duplicate_onboarding`): "You have already added this customer", with a link to the existing record (`client_code`), in en, hi and bn. The server's English text is never shown.
- **Names by code:**
  - Site documents are now translated by code (new `documents.typeLabels` in en, hi and bn).
  - Photo slots come from `photo_slot_items`.
  - Execution evidence uses `*_items` labels as the fallback.
  - The estimate segment is a select with the four codes plus "Set from the site type".
  - No label is ever looked up by its English text.
- **FE-19 minor items:**
  - The "At the house" heading appears once (the location card no longer repeats it).
  - The counters read "6 months entered (3 needed)" and "6 uploaded (4 needed)" in all three languages.
  - The review step has a read-only summary before Submit (customer, mobile, address, site type, size, documents, photos).
  - State and district names display in title case (`placeName`); the stored value is the LGD code.

## Second pass — the journey in the real UI (local BE-20 backend, stub sign-in, real Chrome)

A Studio proposal (3 kWp, ₹2,01,465.00) was issued, then converted to a direct lead.

| Step | Result |
|---|---|
| Sales opens `?tab=payments` before acceptance | "Payments start when the customer accepts the proposal." |
| Customer accepts online | 200; the schedule was created (20/60/20: ₹40,293 · ₹1,20,879 · ₹40,293). |
| Sales after acceptance | Totals and schedule read-only; no record form, no actions. |
| Accounts A records ₹9,99,99,999 | Refused: "Outstanding: ₹2,01,465.00 (accepted total …, already recorded ₹0.00)". |
| Accounts A records the advance by NEFT | Recorded; proof prompt shown. |
| Accounts A tries to verify their own record | Verify disabled; "You recorded this payment, so another Accounts person must verify it." |
| Accounts B verifies | Verified ₹40,293; receipt GNR-…-000005 held, with the P6 sentence. |
| A records a cheque dated in the future | Refused: "The cheque date can't be later than today." |
| A records the material cheque; B deposits, verifies, dishonours | The receipt becomes void; verified falls back to the advance alone. |
| A presents the same cheque again | "Re-presents bounced payment #6"; B verifies. |
| A records the final payment by RTGS; B verifies | Done. |
| Management, at 375 px phone width | Verified ₹2,01,465.00, **balance ₹0.00, all three milestones Paid**; no action buttons; no sideways scroll. |
| Accounts workspace | Rows tagged Direct with "Open lead"; Instalments tagged; `?lead_id` shows 4 rows. |

**Friction found and fixed:**

1. Accounts were shown "no access" on the alert link (they now get the payments-only page).
2. The record form still showed on a fully paid customer (it now says "Fully paid").

**Seen, not frontend:**

- Duplicate references are refused across all customers, not just this one: the server's rule, worked as documented.
- A one-off `500` on `/employees/me` came from the known development-only provisioning race (`UNIQUE employees.email`). The page recovered.

## Checks — baseline → after

| Check | Baseline | After |
|---|---|---|
| Vitest | 2,981 / 2,981 (195 files) | **3,088 / 3,088 (198 files)** |
| tsc | clean | clean |
| lint | 0 errors, 2 warnings | 0 errors, the same 2 warnings |
| build (`NEXT_PUBLIC_API_URL=https://api.example.test`) | clean | clean |
| Playwright e2e | — | 56 / 56 |
| Visual matrix (changed pages) | — | **189 / 189**: the lead Payments tab as Admin, Accounts, Management and Sales, Accounts with `?lead_id`, Instalments, `/dashboard/accounts`, `/dashboard/leads/1`, across all 21 viewports |

**Not covered by the visual matrix:**

- Move customers and the hi/bn portal pages, because the scratch backend had no seeded associates. They are covered by unit tests.
- Real Clerk sign-in, real email, the R2 signed links, and a real phone.

**New tests:**

- `fe20-direct-payments` (39): role matrix, record validation and every error code, self-verification, held, ready and void receipts, the 409 redirect, the deep link, Operations getting no tab, Accounts getting the payments-only page.
- `fe20-associate-loose-ends` (24): duplicate customer in en/hi/bn, review summary, single heading, names by code, counters, title case.
- `fe20-contract` (33): routes, bodies, every documented code, and the §9 code lists against the copy.
- Additions to `accounts-workspace` (direct rows, lead filter, detail link), `fe19-staff-associates` (tick list), `field-portal-views` (counter) and `onboarding-estimate-section` (segment).
- The FE-18 money scan now covers every payment component plus the Accounts pages. The Accounts pager's page count moved into `pageCount()` so the scan stays strict.

## Files

- **New:** `components/dashboard/{LeadPaymentsTab,PaymentActions,DirectCustomer}.tsx`, `lib/dashboard/lead-payments-api-client.ts`, `lib/associate/place-names.ts`, the three test files above, and this report.
- **Changed:**
  - Pages: the lead detail page, the Accounts page, the payment detail page, Move customers, and the two portal customer pages.
  - Components: the wizard, the customer page (`OnboardingDetail`), `EstimateSection`, `SiteLocationStep`, `TerritorySelect`, the execution evidence form and panel, `RecordPaymentForm`, `StaffPaymentsSection`, `QueuePager`.
  - Types and API clients in `lib/`.
  - `messages/{en,hi,bn}.json`.
  - `tests/visual/matrix.ts` (FE-20 cases; `VISUAL_DIRECT_LEAD_ID`).

## What the contract did not cover

1. **The alert email link** is `/dashboard/leads/{id}` with no `?tab=payments` (backend `notifier._staff_message`), so it opens on Overview for Sales, Admin and Management. The frontend supports `?tab=payments`; the backend should append it.
2. **Accounts cannot read leads** (BE-17 matrix), yet BE-20 sends them to the lead. Handled with the payments-only page. Product should confirm Accounts are not meant to see the lead itself.
3. **No `lead_id` filter on `GET /payment-milestones`**, so the lead filter applies to Payments and Receipts only.
4. **`recorded_by` / `verified_by` are employee ids**, not names, so the screens show ids (as the Accounts pages already did).
5. **DP-1 (refunds/cancellation of an order), P6 (receipt wording, tax invoices), DP-2 (later milestones' due dates)** are still open; the UI shows only what the server reports.
