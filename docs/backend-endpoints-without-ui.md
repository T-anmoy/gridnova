# Backend endpoints with no frontend UI — decision needed

Written during the QA fix pass (2026-08). Three real, working backend endpoints have no
frontend caller anywhere in this repo. Per instruction, no speculative UI was built for
these — this is an assessment to support a real decision, not a guess dressed up as a fix.

## Assessment: all three read as missing staff-facing UI, not agent-internal-only

The strongest evidence: **all three require an authenticated employee and a role check**
(`can_adjust_pricing()`, `can_schedule_meeting()`, employee-scoped `/me/` routes). The AI
sales agent doesn't operate through these authenticated REST endpoints — it runs through
its own internal orchestrator/agent code path with no employee session. An endpoint gated
by "does this staff member's role allow this" only makes sense as something a human staff
member is meant to click a button for.

### 1. `PATCH /api/v1/dashboard/proposals/{id}/adjust-pricing`
Role-gated to admin/sales (`can_adjust_pricing()`). Lets staff manually override a
proposal's `total_value` and re-evaluates whether manager sign-off is now required.

**Read as:** a missing "Adjust Pricing" control on the Proposal detail page
(`app/dashboard/proposals/[id]/page.tsx`), likely alongside the existing "Request Revision"
action. There's no conversational/agent equivalent — pricing overrides are an inherently
manual, accountable action.

### 2. `POST /api/v1/dashboard/leads/{id}/schedule-meeting`
Role-gated to admin/sales (`can_schedule_meeting()`). The backend's own docstring:
*"Employee-initiated booking — books on a connected calendar after re-verifying the slot is
free (shares `book_meeting` with the conversational path)."*

**Read as:** confirmed missing UI, not agent-internal — the docstring explicitly
distinguishes this from "the conversational path" (which Ask Nova / the Sales Agent already
use to offer and confirm meeting slots inside the chat). This endpoint is the staff-facing
counterpart: a "Schedule Meeting" action on the Lead detail page for when an employee wants
to book a slot directly (e.g. after a phone call) without going through chat.

### 3. `GET /api/v1/dashboard/employees/me/calendar/connect` + `/callback`
Google Calendar OAuth flow, scoped to `/me/` (the authenticated employee's own calendar).

**Read as:** missing "Connect your Google Calendar" account-settings UI. This is
prerequisite infrastructure for #2 — `schedule-meeting` needs a connected calendar to check
free/busy against. Without a UI entry point, no employee can ever connect a calendar, which
means #2 is currently unreachable for every employee even if its own UI were built.

## Suggested priority if the team decides to build these

`calendar/connect` UI first (it's a blocking dependency for `schedule-meeting`), then
`schedule-meeting`, then `adjust-pricing` (independent of the other two, lower urgency since
`request-revision` already covers the "something's wrong with this proposal" case, just not
a same-version numeric override).
