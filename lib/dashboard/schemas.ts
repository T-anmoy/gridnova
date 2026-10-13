import '@/lib/zod-config'
import { z } from 'zod'

// Runtime shape validation for backend responses, applied at the fetch boundary
// in api-client.ts. This exists because the exact bug class it guards against
// has already happened five separate times in this codebase: a frontend type
// asserts a shape (a bare array, a field name, an envelope) the backend does
// not actually return, and nothing catches it until a user hits a crash or a
// silently-wrong render. A schema mismatch should fail loudly, in dev, with
// the specific field that didn't match — not reach production as a blank
// chart or a "TypeError: x.map is not a function".
//
// Deliberately lightweight: these validate the shape actually consumed by the
// UI (required fields, array-vs-envelope, nesting), not every field to the
// last decimal type. Fields that are legitimately role-conditional (e.g.
// ProposalSummary's pricing fields, which the backend omits entirely for the
// Engineer role) are optional here on purpose — the goal is catching real
// contract breaks, not manufacturing false positives for known variants.

export const overviewStatsSchema = z.object({
  new_leads_today: z.number(),
  follow_ups_due: z.number(),
  pending_approval: z.number(),
  pending_manager_signoff: z.number(),
  trends: z.object({
    new_leads_today: z.number(),
    follow_ups_due: z.number(),
    pending_approval: z.number(),
    pending_manager_signoff: z.number(),
  }),
})

const activityItemSchema = z.object({
  description: z.string(),
  entity_type: z.string(),
  entity_id: z.union([z.string(), z.number()]),
  action: z.string(),
  actor: z.string().nullable(),
  created_at: z.string().nullable(),
})
export const activityFeedResponseSchema = z.object({ items: z.array(activityItemSchema) })

const conversionBySourceSchema = z.object({
  source: z.string(),
  total_leads: z.number(),
  won_leads: z.number(),
  conversion_rate: z.number().nullable(),
})
export const conversionBySourceResponseSchema = z.object({ by_source: z.array(conversionBySourceSchema) })

const dealSizeByTierSchema = z.object({
  tier: z.string(),
  proposal_count: z.number(),
  average_value: z.number().nullable(),
  total_value: z.number().nullable(),
})
export const dealSizeByTierResponseSchema = z.object({ by_tier: z.array(dealSizeByTierSchema) })

const repPerformanceSchema = z.object({
  employee_id: z.string(),
  name: z.string(),
  leads_handled: z.number(),
  proposals_drafted: z.number(),
  proposals_won: z.number(),
  avg_time_to_close_hours: z.number().nullable(),
})
export const repPerformanceResponseSchema = z.object({ reps: z.array(repPerformanceSchema) })

const pipelineTrendPointSchema = z.object({
  week_start: z.string(),
  leads_created: z.number(),
  proposals_won: z.number(),
})
export const pipelineTrendResponseSchema = z.object({ weeks: z.array(pipelineTrendPointSchema) })

const leadSummarySchema = z.object({
  id: z.number(),
  customer_id: z.number(),
  customer_name: z.string().nullable().optional(),
  pipeline_stage: z.string(),
  lead_score: z.string(),
  source: z.string(),
  created_at: z.string(),
  assigned_employee_id: z.string().nullable().optional(),
  project_reference_id: z.string().nullable().optional(),
})
// BE-1 §2: the standard paged envelope (it used to be a bare array).
export const leadListResponseSchema = z.object({
  items: z.array(leadSummarySchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
})

const meetingCustomerSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
})
const meetingSummarySchema = z.object({
  id: z.number(),
  lead_id: z.number(),
  employee_id: z.string(),
  employee_name: z.string().nullable(),
  customer: meetingCustomerSchema.nullable(),
  scheduled_at: z.string(),
  duration_minutes: z.number(),
  status: z.string(),
  meet_link: z.string().nullable().optional(),
})
export const meetingListResponseSchema = z.object({
  items: z.array(meetingSummarySchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
})

// Common to both the full staff view and the pricing-stripped Engineer view —
// the fields unique to either variant are intentionally left unvalidated.
const proposalSummarySchema = z.object({
  id: z.number(),
  lead_id: z.number(),
  version: z.number(),
  status: z.string(),
  // accept_url (Prompt 02c) is the real full website accept link — always
  // use it. accept_path is the backend's own API path and must never be
  // rendered/linked; declared here only so a real response isn't rejected.
  accept_url: z.string().nullable().optional(),
  accept_path: z.string().nullable().optional(),
}).passthrough()

export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number(),
    page_size: z.number(),
    total: z.number(),
  })
}
export const proposalListResponseSchema = paginatedResponseSchema(proposalSummarySchema)

// Public proposal-accept endpoint (GET view / POST accept). `scope` is the
// field that crashed the page — an array of composable sections, never a
// plain string. See lib/proposal-accept.ts for the full normalisation.
export const proposalAcceptResponseSchema = z.object({
  id: z.number().optional(),
  proposal_id: z.number().optional(),
  version: z.number().optional(),
  status: z.string().optional(),
  state: z.string().optional(),
  accepted_at: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  validity: z.string().nullable().optional(),
  total_value: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  customer: z.object({ name: z.string().nullable().optional(), company: z.string().nullable().optional() }).nullable().optional(),
  scope: z.union([
    z.string(),
    z.array(z.object({ id: z.string().nullable().optional(), body: z.string().nullable().optional() })),
  ]).nullable().optional(),
  scope_summary: z.string().nullable().optional(),
  scope_of_work: z.string().nullable().optional(),
  content: z.object({ scope_of_work: z.string().nullable().optional() }).nullable().optional(),
  already_accepted: z.boolean().optional(),
  pdf_available: z.boolean().optional(),
})

// Ask Nova's chat endpoint.
// BE-1 §1: the conversation is identified only by `session_token`; lead_id and
// customer_id are no longer returned.
export const chatMessageResponseSchema = z.object({
  reply: z.string(),
  session_token: z.string().min(1),
  is_qualified: z.boolean().optional(),
  missing_fields: z.array(z.string()).optional(),
  meeting_booked: z
    .object({
      meeting_id: z.number(),
      scheduled_at: z.string(),
      meet_link: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})

// /book-a-call's public booking endpoints.
const bookingSlotSchema = z.object({
  scheduled_at: z.string(),
  label: z.string(),
})
export const bookingAvailabilityResponseSchema = z.object({
  duration_minutes: z.number(),
  days_ahead: z.number(),
  slots: z.array(bookingSlotSchema),
})
export const bookingCreateResponseSchema = z.object({
  success: z.boolean(),
  lead_id: z.number(),
  meeting_id: z.number(),
  scheduled_at: z.string(),
  duration_minutes: z.number(),
  meet_link: z.string().nullable().optional(),
})
// The 409 body's `detail` on a slot conflict — already names the exact
// requested time and carries freshly-computed nearby alternatives, so the
// frontend can show both directly instead of re-deriving them.
export const bookingConflictDetailSchema = z.object({
  code: z.literal("slot_unavailable"),
  message: z.string(),
  requested_slot: z.string(),
  alternatives: z.array(bookingSlotSchema),
})

// Formats a ZodError into a single-line, field-specific message — e.g.
// "trends.new_leads_today: Invalid input: expected number, received string"
// — so a shape mismatch is diagnosable from the thrown error alone.
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}
