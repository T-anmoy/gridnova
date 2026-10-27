import type { ApprovalAction, ApprovalRequest } from './types'

// Second approval (maker–checker, access_control.md §5): pure helpers for the inbox,
// its badge and the "waiting for a second Admin" notes.

const ACTION_LABELS: Record<ApprovalAction, string> = {
  'staff.set_roles': 'Role change',
  'staff.invite': 'Staff invitation',
  'commissions.standard_rate_publish': 'Standard commission rates',
  'commissions.individual_rate_change': 'Individual commission rate',
  'payouts.batch_approve': 'Payout batch approval',
}

export function approvalActionLabel(action: string): string {
  return (ACTION_LABELS as Record<string, string>)[action] ?? action.replace(/[._]/g, ' ')
}

/** Who has to decide: role changes and invitations need a second Admin; the money actions a second approver. */
export function waitingForLabel(action: string): string {
  return action.startsWith('staff.') ? 'Waiting for a second Admin' : 'Waiting for a second approver'
}

/** Every role a staff request touches: the new set (`roles`) and, for a change, the old one (`before`). */
export function rolesTouched(r: ApprovalRequest): string[] {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return [...new Set([...list(r.payload?.roles), ...list(r.payload?.before)])]
}

/**
 * Pending requests someone else asked for that this person can decide. GET /approvals also
 * lists staff requests to a Network Manager (staff.manage) that only an Admin may approve —
 * approving answers 403 role_not_assignable — so a staff request shows only when every role
 * it touches is one `canAssign` covers.
 */
export function decidable(items: ApprovalRequest[] | undefined, myId: string | undefined, canAssign?: readonly string[]): ApprovalRequest[] {
  if (!myId) return []
  return (items ?? []).filter(
    (r) => r.status === 'pending' && r.requested_by !== myId && (!canAssign || !r.action.startsWith('staff.') || rolesTouched(r).every((x) => canAssign.includes(x))),
  )
}

export function decidableCount(items: ApprovalRequest[] | undefined, myId: string | undefined, canAssign?: readonly string[]): number {
  return decidable(items, myId, canAssign).length
}

/** My own pending requests (I see "waiting", and may withdraw them). */
export function myPending(items: ApprovalRequest[] | undefined, myId: string | undefined): ApprovalRequest[] {
  if (!myId) return []
  return (items ?? []).filter((r) => r.status === 'pending' && r.requested_by === myId)
}

/** True for a pending request past its expiry (the backend marks it expired on its next read). */
export function isPastExpiry(r: ApprovalRequest, now: Date = new Date()): boolean {
  return new Date(r.expires_at).getTime() <= now.getTime()
}
