import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { formatRate, isValidRate } from '@/lib/commissions/rates'
import type { AssociateRate, IndividualRateRow } from '@/lib/commissions/schemas'

// Rules for the "Change rate" form (BE-12). The server stays the authority — it still
// refuses with 422 notice_period / effective_in_past / invalid_rate / out_of_bounds /
// reason_required — so everything here only guides the form. A rate is a decimal string; the
// stepper works on whole ten-thousandths so it never goes through floating point.

const UNITS = 10_000
export const STEP_UNITS = 2_500
export const MIN_REASON_LENGTH = 10

/** "8.5" → 85000 ten-thousandths; null when it is not a valid 0–100 rate with up to 4 decimals. */
export function toUnits(value: string | null | undefined): number | null {
  const v = (value ?? '').trim()
  if (!isValidRate(v)) return null
  const [whole, frac = ''] = v.split('.')
  return Number(whole) * UNITS + Number(frac.padEnd(4, '0'))
}

/** 85000 → "8.5" (trailing zeros trimmed). */
export function fromUnits(units: number): string {
  const clamped = Math.min(100 * UNITS, Math.max(0, Math.round(units)))
  const whole = Math.floor(clamped / UNITS)
  const frac = String(clamped % UNITS).padStart(4, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : String(whole)
}

/** The stepper's size as text, e.g. "0.25" — for the button labels. */
export const STEP_LABEL = fromUnits(STEP_UNITS)

/** One stepper press. An unreadable value starts from zero. */
export function stepRate(value: string, direction: 1 | -1): string {
  return fromUnits((toUnits(value) ?? 0) + direction * STEP_UNITS)
}

/**
 * Is the change a reduction? `next` null = back to the standard rate. A reduction is judged against
 * the rate in effect today; with no confirmed rate nobody relies on one, so it is never a reduction.
 */
export function isReduction(next: string | null, rate: AssociateRate): boolean {
  const current = toUnits(rate.effective.rate_percent)
  const target = toUnits(next === null ? rate.standard?.rate_percent : next)
  return current !== null && target !== null && target < current
}

/** The earliest date for this change, read from the response — never assumed. */
export function earliestDate(next: string | null, rate: AssociateRate): string {
  return isReduction(next, rate) ? rate.notice.reduction_earliest_effective_from : rate.notice.increase_earliest_effective_from
}

export type RateField = 'rate_percent' | 'effective_from' | 'reason'

export interface RateFormProblems {
  rate_percent?: string
  effective_from?: string
  reason?: string
}

/** Checks in the server's order: reason, rate, bounds, date. `next` = the rate text, or null for "standard". */
export function validateRateForm(input: { next: string | null; effectiveFrom: string; reason: string }, rate: AssociateRate): RateFormProblems {
  const problems: RateFormProblems = {}
  if (input.reason.trim().length < MIN_REASON_LENGTH) problems.reason = `Write the reason in at least ${MIN_REASON_LENGTH} characters.`
  if (input.next !== null) {
    const units = toUnits(input.next)
    if (units === null) problems.rate_percent = 'Enter a rate between 0 and 100, with up to 4 decimals.'
    else {
      const min = toUnits(rate.bounds.min_percent)
      const max = toUnits(rate.bounds.max_percent)
      if ((min !== null && units < min) || (max !== null && units > max)) problems.rate_percent = boundsMessage(rate.bounds.min_percent, rate.bounds.max_percent)
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) problems.effective_from = 'Choose the date the new rate starts.'
  else {
    const earliest = earliestDate(input.next, rate)
    if (input.effectiveFrom < earliest) problems.effective_from = dateMessage(isReduction(input.next, rate), earliest)
  }
  return problems
}

function boundsMessage(min: string | null | undefined, max: string | null | undefined): string {
  if (min && max) return `The rate must be between ${formatRate(min)} and ${formatRate(max)}.`
  if (min) return `The rate must be at least ${formatRate(min)}.`
  if (max) return `The rate must be at most ${formatRate(max)}.`
  return 'That rate is outside the allowed limits.'
}

const dateMessage = (reduction: boolean, earliest: string): string =>
  `${reduction ? 'A lower rate needs notice.' : 'A rate change needs notice.'} The earliest date is ${formatDate(earliest)}.`

/** The server's refusal as one plain sentence, attached to the field it names. */
export function individualRateError(err: unknown): { field: RateField | 'general'; message: string } {
  if (err instanceof ApiError) {
    const d = err.structuredDetail
    const code = typeof d?.code === 'string' ? d.code : ''
    const earliest = typeof d?.earliest_effective_from === 'string' ? d.earliest_effective_from : ''
    switch (code) {
      case 'notice_period':
        return { field: 'effective_from', message: earliest ? `A lower rate takes effect only after the notice period. The earliest date is ${formatDate(earliest)}.` : 'A lower rate takes effect only after the notice period.' }
      case 'effective_in_past':
        return { field: 'effective_from', message: earliest ? `That date has passed. The earliest date is ${formatDate(earliest)}.` : 'That date has passed. Choose today or a later date.' }
      case 'invalid_rate':
        return { field: 'rate_percent', message: 'Enter a rate between 0 and 100, with up to 4 decimals.' }
      case 'out_of_bounds':
        return { field: 'rate_percent', message: boundsMessage(typeof d?.min_percent === 'string' ? d.min_percent : null, typeof d?.max_percent === 'string' ? d.max_percent : null) }
      case 'reason_required':
        return { field: 'reason', message: `Write the reason in at least ${MIN_REASON_LENGTH} characters.` }
    }
    if (err.status === 403) return { field: 'general', message: 'Only an Admin can change a commission rate.' }
    if (err.status === 404) return { field: 'general', message: 'That Associate could not be found.' }
    if (err.status === 0) return { field: 'general', message: 'Can’t reach the server. Check the connection and try again.' }
    if (err.status === 429) return { field: 'general', message: 'Too many requests — wait a moment and try again.' }
  }
  return { field: 'general', message: 'Something went wrong. Please try again.' }
}

export interface HistoryLine {
  row: IndividualRateRow
  /** The rate the row replaced: the next older row's rate, or null = the standard schedule. */
  before: string | null
}

/** History is newest first; each line's "old" side is the row below it. null on either side = standard. */
export function historyLines(history: IndividualRateRow[]): HistoryLine[] {
  return history.map((row, i) => ({ row, before: history[i + 1]?.rate_percent ?? null }))
}

/** Dates in a performance range: both set, in order, and at most 366 days (the server's own limit). */
export function rangeProblem(from: string, to: string): string | null {
  if (!from && !to) return null
  if (!from || !to) return 'Choose both dates.'
  if (from > to) return 'The start date must not be after the end date.'
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1
  return days > 366 ? 'Choose a period of at most 366 days.' : null
}
