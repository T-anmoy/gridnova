import { isPositiveAmount } from '@/lib/money'
import type { PayoutLine } from './schemas'

// Who may do what to a payout batch. The server enforces all of this (409 self_approval,
// 403 on the bank file for anyone but Accounts); the screen mirrors it so a control that
// would always be refused is never shown.

export type ApprovalMode =
  | 'none' // nothing to approve: not a draft, or the role cannot act
  | 'loading' // the signed-in employee is not known yet, so "am I the preparer?" cannot be answered
  | 'approve' // a different person prepared it
  | 'override' // an Admin who prepared it: allowed only with a reason (audited)
  | 'preparer-blocked' // Accounts prepared it: someone else has to approve

export function approvalMode(input: { status: string; role: string | undefined; employeeId: string | undefined; preparedBy: string | null | undefined }): ApprovalMode {
  const { status, role, employeeId, preparedBy } = input
  if (status !== 'draft') return 'none'
  if (role !== 'admin' && role !== 'accounts') return 'none'
  if (!employeeId) return 'loading'
  if (!preparedBy || preparedBy !== employeeId) return 'approve'
  return role === 'admin' ? 'override' : 'preparer-blocked'
}

/** The payout bank file holds full account numbers: Accounts only (an Admin gets 403), approved or paid batches. */
export function canDownloadBankFile(role: string | undefined, status: string): boolean {
  return role === 'accounts' && (status === 'approved' || status === 'paid')
}

/** Lines with money to pay — only these need a bank reference. Read from the strings, never summed. */
export function payableLines(lines: PayoutLine[] | null | undefined): PayoutLine[] {
  return (lines ?? []).filter((l) => isPositiveAmount(l.net))
}
