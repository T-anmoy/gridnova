import { ApiError } from '@/lib/dashboard/api-error'
import { paymentErrorMessage } from '@/components/payments/payment-errors'
import { STAFF_PAYMENT_COPY } from '@/lib/dashboard/staff-copy'

export const STATUS_LABEL: Record<string, string> = {
  recorded: 'Recorded',
  deposited: 'Deposited',
  verified: 'Verified',
  dishonoured: 'Dishonoured',
  cancelled: 'Cancelled',
}

export const STATUS_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'gray'> = {
  recorded: 'amber',
  deposited: 'blue',
  verified: 'green',
  dishonoured: 'red',
  cancelled: 'gray',
}

// Why a payment / milestone needs attention, in plain words. Thresholds
// (hours, days) are tunable on the backend, so none are hard-coded here.
export const ATTENTION_LABEL: Record<string, string> = {
  awaiting_verification: 'Waiting too long for verification',
  cheque_hold_exceeded: 'Cheque deposited too long ago',
  proof_missing: 'Proof missing',
  receipt_held: 'Receipt held',
  receipt_pending_email: 'Receipt not emailed yet',
  receipt_failed: 'Receipt failed',
  overdue: 'Overdue',
}

// Payment methods Grid Nova no longer accepts (associate_journeys.md §5: cheque, NEFT, RTGS and
// IMPS only). Rows recorded before the change keep their mode and are shown as history.
export const RETIRED_PAYMENT_MODES: readonly string[] = ['demand_draft', 'upi']

/** "Cheque", or "UPI (no longer accepted)" for a row recorded with a retired method. */
export function staffModeLabel(mode: string): string {
  const label = STAFF_PAYMENT_COPY.modes[mode as keyof typeof STAFF_PAYMENT_COPY.modes] ?? mode
  return RETIRED_PAYMENT_MODES.includes(mode) ? `${label} (no longer accepted)` : label
}

// Held-receipt reasons that come from DUMMY/placeholder company details.
export const isDummyReason = (reason: string | null | undefined): boolean => !!reason && /dummy|placeholder/i.test(reason)

const STAFF_PAYMENT_ERRORS: Record<string, string> = {
  invalid_transition: 'This payment can’t be changed in its current state.',
  not_an_instrument: 'Only cheques are deposited — other methods go straight to verification.',
  proof_required:
    'This payment was recorded by an associate and has no proof of payment yet. Attach proof (or ask the associate to) before verifying.',
  reason_required: 'A reason is required.',
  self_verification: 'You recorded this payment yourself, so you can’t verify it. Another person in Accounts has to.',
  no_receipt: 'This payment has no receipt yet — receipts are issued when a payment is verified.',
  resend_too_soon: 'A receipt was sent a moment ago. Please wait a few minutes before sending it again.',
  schedule_locked: 'The schedule is locked because payments have already been recorded.',
  invalid_schedule: 'The schedule is not valid: it needs the same number of instalments, with percentages that total 100.',
  no_accepted_total: 'The accepted proposal has no total yet, so there is nothing to schedule.',
  not_found: 'That could not be found.',
}

/** Plain-English message for a staff payment action failure. */
export function staffPaymentError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (typeof code === 'string' && code in STAFF_PAYMENT_ERRORS) return STAFF_PAYMENT_ERRORS[code]
    if (err.status === 429) return STAFF_PAYMENT_ERRORS.resend_too_soon
    if (typeof code === 'string') return paymentErrorMessage(err, STAFF_PAYMENT_COPY)
    if (err.status === 403 && err.detail) return err.detail
  }
  return paymentErrorMessage(err, STAFF_PAYMENT_COPY)
}

export const isSelfVerification = (err: unknown): boolean => err instanceof ApiError && err.structuredDetail?.code === 'self_verification'

/** Case-insensitive match of a typed filter against any of the given fields (the customer's name or the project code). */
export const matchesFilter = (query: string, ...fields: (string | null | undefined)[]): boolean => {
  const q = query.trim().toLowerCase()
  return !q || fields.some((f) => !!f && f.toLowerCase().includes(q))
}
