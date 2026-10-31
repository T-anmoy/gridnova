# FE-22 — Launch content: approve the wording in the dashboard, explain every hold

Built on `main` (4af0a13) against the copied BE-22 contract: `docs/api/launch_content.md`, `docs/api/README.md`, `docs/api/phase4a.md` and `openapi.json` (backend 8baa569). **Not committed or pushed.**

## What BE-22 changed for the screens

Nine texts customers or associates read (proposal terms PRO-2, four scopes and two notes PRO-7/8/10/11/12, the customer agreement ONB-5, the receipt wording P6, the O&M terms after year one HW-OM) are drafted in config. None is used until an Admin approves it, exactly as written (by its SHA-256). Editing a text lapses its approval. Until approved: proposal send answers `409 unapproved_sections`, a generic-scope proposal answers `409 manual_review_required`, no agreement is generated (`agreement_wording_not_approved`), and receipts and handover packs are held (`held_reason: wording_not_approved`). Unpriced proposals have `total_value: null` ("Price to be set by Grid Nova"), never ₹0. Payout batches list a `tds_review`, and approve / mark-paid need `tds_review_acknowledged`.

## Screens changed

- **Data checklist** (`/dashboard/data-checklist`):
  - A banner counts the drafted texts still waiting for approval and says what they hold.
  - Each wording row shows its state ("Wording not approved", "Changed since approval", "Wording approved") and "Legal review needed" for PRO-2 and ONB-5. It shows who approved it, when, the note, and whether legal review was confirmed. A lapsed row also says who approved the earlier version.
  - **Read and approve…** (Admin) opens `ApproveWordingDialog`:
    - The full text, scrollable, with its location and a 12-character fingerprint.
    - The legal-review tick where required: Approve stays off until it is ticked.
    - An optional note.
  - Approving sends the `current_sha256` the Admin read. `text_changed` reloads the list and says to read the new text again. Every other approve code has its own sentence.
  - **Revoke…** (Admin) needs a reason.
  - Management can **Read** a text but cannot approve or revoke it.
- **Proposal page:**
  - A header with no total reads "Price to be set by Grid Nova", never ₹0.
  - Send 409s `unapproved_sections` and `manual_review_required` are explained in the banner: which sections, with a link to the Data checklist; or "it used the generic scope, set the segment / consumer category". `missing_total_value` says to use Adjust Pricing.
- **Adjust pricing:** a total of zero or below is refused before sending ("Enter a total above zero"), matching the API's `new_value > 0`.
- **Agreement, dashboard** (onboarding page):
  - While `wording_approved` is false: a note linking the Data checklist (ONB-5), and Generate / Regenerate are off.
  - `needs_regeneration`: "printed from wording that is not the approved one … Regenerate it".
  - Generate errors are shown; before, they were silently dropped.
- **Agreement, portal** (en / hi / bn): a generated copy with no link (`needs_regeneration`) says "Grid Nova is updating the agreement" instead of "not generated".
  - New in-person acceptance messages: `unapproved_sections` and `manual_review_required`.
  - New upload error: `agreement_wording_not_approved`.
  - Associates are never shown the internal approval detail.
- **Receipts** (Accounts list and payment page): `wording_not_approved` shows a "Wording not approved" chip and a sentence; the release-held notice uses the same sentence.
- **Handover pack:** a pack held for `wording_not_approved` names HW-OM and links the Data checklist. Once it is approved, staff send the link again.
- **Payout batch:**
  - A TDS review panel lists each associate above the threshold, with FY commission to date, the threshold and the API's message.
  - Approve, approve-with-override and mark-paid each need a tick: "confirmed with Grid Nova's Chartered Accountant …". It is sent as `tds_review_acknowledged`.
  - A `409 tds_review_required` from a stale page reloads the batch.
  - No TDS rate or section appears anywhere.
- **Studio:** `content_not_ready` now says the wording is "missing or not yet approved by an Admin (Data checklist)".
- `ConfirmDialog` gained `confirmDisabled`, and `ReasonDialog` gained `children`, for the acknowledgement ticks.

## Checks

- `tsc --noEmit`, `eslint .`: clean.
- `next build` (CI's test keys): passes.
- Unit tests: 3132 passed in 200 files. That includes the new `tests/unit/fe22-launch-content.test.tsx` (17) and new cases in the proposal-page, payout-batch, staff-onboarding and portal tests.
- Playwright e2e: **not run on this PC.** Its Chromium build is not installed, and installing it means downloading about 100 MB. The suite covers only public pages FE-22 does not touch, and CI runs it.
