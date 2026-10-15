import '@/lib/zod-config'
import { z } from 'zod'

// BE-4 contract (grid-nova-ai-backend docs/api/commissions.md). The backend publishes no
// response schema for these routes, so these zod shapes are the runtime guard: money is
// always a decimal STRING and is only formatted, never added up, in the browser.

const str = z.string().nullish()
const person = z.looseObject({ associate_id: z.string(), full_name: z.string() })

export const commissionEntrySchema = z.looseObject({
  entry_id: z.number(),
  associate: person.nullish(),
  earning_role: z.string(),
  kind: z.string(),
  status: z.string(),
  customer_name: str,
  project_reference_id: str,
  onboarding_id: z.number().nullish(),
  payment_id: z.number().nullish(),
  basis_amount: str,
  rate_percent: str,
  holders: z.number().nullish(),
  amount: str,
  pending_reason: str,
  pending_message_key: str,
  schedule_version: z.number().nullish(),
  agreement_date: str,
  reverses_entry_id: z.number().nullish(),
  reversed_by_entry_id: z.number().nullish(),
  reason: str,
  batch: z.looseObject({ batch_id: z.number(), period: z.string(), status: z.string() }).nullish(),
  created_at: z.string(),
  approved_at: str,
  paid_at: str,
  created_by: str,
  approved_by: str,
  rated_by: str,
  rated_at: str,
  query: z.looseObject({ open: z.boolean(), window_closes_at: str }).nullish(),
})
export type CommissionEntry = z.infer<typeof commissionEntrySchema>

const paged = <T extends z.ZodType>(item: T) =>
  z.looseObject({ items: z.array(item), page: z.number(), page_size: z.number(), total: z.number() })

export const associateCommissionsSchema = paged(commissionEntrySchema).extend({
  summary: z.looseObject({
    earned: z.string(),
    approved: z.string(),
    paid: z.string(),
    pending_count: z.number(),
    to_recover: str,
    financial_year: str,
    fy_taxable_commission: str,
    fy_tds_deducted: str,
    next_payout: z.looseObject({ period: z.string(), expected_by: z.string() }).nullish(),
  }),
})
export type AssociateCommissions = z.infer<typeof associateCommissionsSchema>

export const staffCommissionsSchema = paged(commissionEntrySchema).extend({
  totals: z.looseObject({ earned: z.string(), approved: z.string(), paid: z.string(), pending_count: z.number() }),
})
export type StaffCommissions = z.infer<typeof staffCommissionsSchema>

export const payoutLineSchema = z.looseObject({
  line_id: z.number().nullish(),
  associate: person.nullish(),
  gross: z.string(),
  recoveries: z.string(),
  carried_in: z.string(),
  taxable: z.string(),
  tds: z.string(),
  tds_rate_percent: str,
  net: z.string(),
  carry_forward: z.string(),
  account_holder_name: str,
  bank_account_last4: str,
  bank_ifsc: str,
  bank_reference: str,
  paid_at: str,
  pan_on_file: z.boolean().nullish(),
  fy_taxable_before: str,
  fy_tds_before: str,
})
export type PayoutLine = z.infer<typeof payoutLineSchema>

export const associatePayoutsSchema = z.looseObject({
  items: z.array(
    payoutLineSchema.extend({ batch_id: z.number(), period: z.string(), financial_year: str, status: z.string() }),
  ),
})
export type AssociatePayouts = z.infer<typeof associatePayoutsSchema>

const totalsSchema = z.looseObject({
  gross: z.string(),
  recoveries: z.string(),
  carried_in: z.string(),
  taxable: z.string(),
  tds: z.string(),
  net: z.string(),
  carry_forward: z.string(),
})
export const payoutBatchSchema = z.looseObject({
  batch_id: z.number(),
  period: z.string(),
  financial_year: str,
  status: z.string(),
  prepared_by: str,
  prepared_at: str,
  approved_by: str,
  approved_at: str,
  approval_override_reason: str,
  paid_by: str,
  paid_at: str,
  cancelled_by: str,
  cancelled_at: str,
  cancel_reason: str,
  totals: totalsSchema,
  line_count: z.number().nullish(),
  lines: z.array(payoutLineSchema).nullish(),
})
export type PayoutBatch = z.infer<typeof payoutBatchSchema>
export const payoutBatchListSchema = z.looseObject({ items: z.array(payoutBatchSchema) })

export const commissionQuerySchema = z.looseObject({
  query_id: z.number(),
  entry_id: z.number(),
  message: z.string(),
  status: z.string(),
  response: str,
  responded_at: str,
  responded_by: str,
  due_at: str,
  created_at: z.string(),
  overdue: z.boolean().nullish(),
  associate: person.nullish(),
  entry: commissionEntrySchema.nullish(),
})
export type CommissionQuery = z.infer<typeof commissionQuerySchema>
export const entryQueriesSchema = z.looseObject({ items: z.array(commissionQuerySchema) })
export const staffQueriesSchema = paged(commissionQuerySchema)

export const rateScheduleSchema = z.looseObject({
  schedule_id: z.number(),
  version: z.number(),
  effective_from: z.string(),
  is_placeholder: z.boolean(),
  note: str,
  published_by: str,
  published_at: str,
  rates: z.record(z.string(), z.string()),
  in_effect: z.boolean().nullish(),
})
export type RateSchedule = z.infer<typeof rateScheduleSchema>
export const rateSchedulesSchema = z.looseObject({
  items: z.array(rateScheduleSchema),
  in_force_schedule_id: z.number().nullish(),
  rate_keys: z.array(z.string()),
  earliest_effective_from: z.string(),
})
export type RateSchedules = z.infer<typeof rateSchedulesSchema>
export const reRateSchema = z.looseObject({
  schedule_id: z.number(),
  rated: z.number(),
  total_amount: z.string(),
  still_pending: z.number(),
})

const count = z.number()
export const networkSummarySchema = z.looseObject({
  period: z.looseObject({ date_from: z.string(), date_to: z.string() }),
  generated_at: str,
  associates: z.array(
    z.looseObject({
      associate_type: z.string(),
      capability: str,
      level: str,
      status: z.string(),
      count,
    }),
  ),
  seats: z.array(
    z.looseObject({
      state_lgd_code: z.number(),
      state_name: z.string(),
      state_heads: z.looseObject({ held: count, max: count }),
      districts: z.looseObject({ with_head: count, total: count }),
      blocks: z.looseObject({ with_associate: count, total: count }),
    }),
  ),
  onboardings: z.looseObject({
    by_status: z.record(z.string(), count),
    by_current_stage: z.record(z.string(), count),
  }),
  verified_revenue: z.looseObject({ credits: z.string(), reversals: z.string(), net: z.string() }),
  commissions: z.looseObject({
    earned: z.string(),
    reversed: z.string(),
    approved: z.string(),
    paid_net: z.string(),
    paid_tds: z.string(),
    pending_count: count,
  }),
  overdue: z.looseObject({
    verification_calls: count,
    survey_reviews: count,
    payments_awaiting_verification: count,
    commission_queries: count,
  }),
})
export type NetworkSummary = z.infer<typeof networkSummarySchema>

export const approveResultSchema = z.looseObject({ approved: z.number(), items: z.array(commissionEntrySchema) })
export const reverseResultSchema = z.looseObject({ entry: commissionEntrySchema })
