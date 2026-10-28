import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'

// Staff-facing (English) words for the commission screens. The associate portal has its own
// translated copies in messages/*.json.

export const ENTRY_STATUS_LABEL: Record<string, string> = { earned: 'Earned', approved: 'Approved', paid: 'Paid', reversed: 'Reversed' }
export const ENTRY_STATUS_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'gray'> = {
  earned: 'amber',
  approved: 'blue',
  paid: 'green',
  reversed: 'gray',
}
export const ENTRY_KIND_LABEL: Record<string, string> = {
  earn: 'Earning',
  reversal: 'Reversal',
  recovery: 'Recovery',
  adjustment: 'Adjustment',
}
export const EARNING_ROLE_LABEL: Record<string, string> = {
  personal_sale: 'Own sale',
  territory_state: 'State territory',
  territory_district: 'District territory',
  territory_block: 'Block territory',
}
export const PENDING_REASON_LABEL: Record<string, string> = {
  agreement_not_signed: 'Waiting for the signed agreement (rated automatically once it is recorded).',
  placeholder_rates: 'Waiting for confirmed rates (an Admin publishes a schedule, then re-rates).',
  basis_unavailable: 'No basic price on a custom-quoted proposal, so no amount can be worked out.',
}
export const BATCH_STATUS_LABEL: Record<string, string> = { draft: 'Draft', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled' }
export const BATCH_STATUS_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'gray'> = {
  draft: 'amber',
  approved: 'blue',
  paid: 'green',
  cancelled: 'gray',
}

/** "2026-10" → "October 2026" (IST month names; no timezone maths needed for a bare month). */
export function formatPeriod(period: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period ?? '')
  if (!m) return period ?? '—'
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)))
}

/** An entry whose amount is a deduction (reversal / recovery) or is simply a negative figure. */
export const isDeduction = (e: { kind: string }): boolean => e.kind === 'reversal' || e.kind === 'recovery'

/** Entries Accounts can approve in bulk: a rated, still-earned earning. */
export const isApprovable = (e: { kind: string; status: string; amount?: string | null }): boolean =>
  e.kind === 'earn' && e.status === 'earned' && e.amount != null

/** Entries an Admin can still reverse. */
export const isReversible = (e: { kind: string; status: string; reversed_by_entry_id?: number | null }): boolean =>
  e.kind === 'earn' && e.status !== 'reversed' && e.reversed_by_entry_id == null

const MESSAGES: Record<string, string | ((d: Record<string, unknown>) => string)> = {
  not_found: 'That could not be found.',
  reason_required: 'A reason is required.',
  entries_not_approvable: (d) => {
    const rows = Array.isArray(d.entries) ? (d.entries as { entry_id?: number; reason?: string }[]) : []
    const why: Record<string, string> = {
      not_found: 'no longer exists',
      not_an_earn_entry: 'is not an earning',
      not_earned: 'is not in the Earned state',
      not_rated: 'has no rate yet',
    }
    const list = rows.map((r) => `#${r.entry_id} ${why[r.reason ?? ''] ?? r.reason ?? ''}`.trim()).join('; ')
    return `Nothing was approved. ${list || 'Some entries cannot be approved.'}`
  },
  not_reversible: 'Only an earning that has not already been reversed can be reversed.',
  invalid_rate_keys: 'The schedule must contain every rate, and only the known ones.',
  invalid_rate: 'Each rate must be between 0 and 100 with at most 4 decimals.',
  notice_period: (d) => `A new rate schedule needs notice: it cannot start before ${formatDate(String(d.earliest_effective_from ?? ''))}.`,
  effective_in_past: (d) =>
    typeof d.earliest_effective_from === 'string' && d.earliest_effective_from
      ? `A schedule cannot start in the past. The earliest date is ${formatDate(d.earliest_effective_from)}.`
      : 'A schedule cannot start in the past.',
  concurrent_publish: 'Another schedule was published at the same moment. Reload and try again.',
  schedule_is_placeholder: 'A placeholder schedule has no real rates, so entries cannot be re-rated from it.',
  invalid_period: 'Choose a valid month.',
  period_not_ended: 'That month has not ended yet.',
  draft_batch_exists: (d) => `A draft payout batch already exists${d.batch_id ? ` (#${d.batch_id})` : ''}. Approve or cancel it first.`,
  batch_exists: 'A payout batch already exists for that month.',
  period_out_of_order: (d) => `Months must be paid in order${d.latest_period ? ` — the latest batch is ${formatPeriod(String(d.latest_period))}` : ''}.`,
  placeholder_rates: (d) =>
    `Commission rates are not confirmed yet, so ${typeof d.pending_entries === 'number' ? `${d.pending_entries} ` : ''}entries of this month have no amount. Publish a real rate schedule and re-rate them first.`,
  // BE-19: a suspended associate's approved commission is frozen — kept out of every batch until reinstatement.
  no_approved_entries: (d) =>
    typeof d.frozen_entries === 'number' && d.frozen_entries > 0
      ? `There is no commission to pay for that month: the ${d.frozen_entries} approved ${d.frozen_entries === 1 ? 'entry belongs' : 'entries belong'} to suspended associates and stay frozen until they are reinstated.`
      : 'There is no approved commission to pay for that month.',
  self_approval: 'You prepared this batch, so a different person has to approve it.',
  invalid_transition: 'The batch cannot be changed in its current state.',
  unknown_associate: 'A bank reference was given for someone who is not in this batch.',
  missing_bank_reference: 'Every line with money to pay needs a bank reference.',
  invalid_bank_reference: 'A bank reference is not valid.',
  batch_not_approved: 'The bank file is only available once the batch is approved.',
  invalid_financial_year: 'Use a financial year like 2026-27.',
  already_answered: 'This query has already been answered.',
  invalid_response: 'Write an answer (up to 2000 characters).',
}

/** One plain sentence for any failed commission call. Never an object, never raw JSON. */
export function commissionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const d = err.structuredDetail
    const code = typeof d?.code === 'string' ? d.code : undefined
    if (code && MESSAGES[code]) {
      const m = MESSAGES[code]
      return typeof m === 'function' ? m(d ?? {}) : m
    }
    if (err.status === 403) return 'Your role cannot do this.'
    if (err.status === 0) return 'Can’t reach the server. Check the connection and try again.'
    if (err.status === 429) return 'Too many requests — wait a moment and try again.'
    if (err.detail && !err.detail.startsWith('{')) return err.detail
  }
  return 'Something went wrong. Please try again.'
}
