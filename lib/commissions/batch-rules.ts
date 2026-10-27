import { isPositiveAmount } from '@/lib/money'
import type { PermissionRule } from '@/lib/access/permissions'
import type { PayoutLine } from './schemas'

// Who may do what to a payout batch. The server enforces all of this (409 self_approval,
// 403 on the bank file for anyone but Accounts); the screen mirrors it so a control that
// would always be refused is never shown. `can` is usePermissions().can.

type Can = (rule: PermissionRule) => boolean

export type ApprovalMode =
  | 'none' // nothing to approve: not a draft, or this person cannot act
  | 'loading' // the signed-in employee is not known yet, so "am I the preparer?" cannot be answered
  | 'approve' // a different person prepared it
  | 'override' // the preparer holds payouts.segregation_override: allowed only with a reason (audited)
  | 'preparer-blocked' // the preparer has no override: someone else has to approve

export function approvalMode(input: { status: string; can: Can; employeeId: string | undefined; preparedBy: string | null | undefined }): ApprovalMode {
  const { status, can, employeeId, preparedBy } = input
  if (status !== 'draft') return 'none'
  if (!can('commissions.process')) return 'none'
  if (!employeeId) return 'loading'
  if (!preparedBy || preparedBy !== employeeId) return 'approve'
  return can('payouts.segregation_override') ? 'override' : 'preparer-blocked'
}

/**
 * The payout bank file holds full account numbers: payouts.bank_file.export only (Accounts —
 * an Admin holds it only with Accounts too), approved or paid batches.
 */
export function canDownloadBankFile(can: Can, status: string): boolean {
  return can('payouts.bank_file.export') && (status === 'approved' || status === 'paid')
}

/** Lines with money to pay — only these need a bank reference. Read from the strings, never summed. */
export function payableLines(lines: PayoutLine[] | null | undefined): PayoutLine[] {
  return (lines ?? []).filter((l) => isPositiveAmount(l.net))
}
