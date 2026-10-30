// Plain-English text for the staff screens that manage associates (the dashboard
// is English-only): invitation state, what a status change did to the associate's
// sign-in, and every error code of the BE-19 associate routes.
import { ApiError } from '@/lib/dashboard/api-error'
import type { AdminAssociate, AssociateAccessChange } from './types'

/** README / access_control.md §4: a record outside the reviewer's regions. */
export const OUTSIDE_REGIONS = 'This record is outside the regions you work in.'

export function isOutsideRegions(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && (error.detail ?? '').trim() === OUTSIDE_REGIONS
}

export type InviteState = 'signed_in' | 'sent' | 'failed' | 'skipped' | 'none'

export function inviteStateOf(a: Pick<AdminAssociate, 'clerk_user_bound' | 'clerk_invite_status'>): InviteState {
  if (a.clerk_user_bound) return 'signed_in'
  return a.clerk_invite_status ?? 'none'
}

export const INVITE_STATE_LABEL: Record<InviteState, string> = {
  signed_in: 'Signed in — the invitation was used',
  sent: 'Sent — not accepted yet',
  failed: 'Failed to send',
  skipped: 'Not sent — Clerk is not set up on the server',
  none: 'No invitation — none sent, or the last one was revoked',
}

/**
 * Whether "Send invitation (again)" applies: any time before the associate signs in
 * (associate_journeys.md §3 — re-sending revokes the old one). A suspended or
 * deactivated associate cannot be invited.
 */
export function canSendInvite(a: Pick<AdminAssociate, 'status' | 'clerk_user_bound'>): boolean {
  return a.status === 'active' && !a.clerk_user_bound
}

/** One sentence per thing that happened to the associate's access. */
export function accessChangeLines(access: AssociateAccessChange | null): string[] {
  if (!access) return ['Their sign-in did not need changing.']
  const lines: string[] = []
  if (access.clerk_banned) lines.push('Their sign-in is blocked and every open session has ended.')
  // BE-21 (Clerk's free plan): sessions are ended instead of a ban; they may sign in again
  // and Grid Nova refuses them.
  if (!access.clerk_banned && typeof access.sessions_revoked === 'number') {
    lines.push(access.sessions_revoked === 0
      ? 'They had no open sessions. Grid Nova refuses them from their next request.'
      : `${access.sessions_revoked === 1 ? 'Their open session was' : `All ${access.sessions_revoked} of their open sessions were`} ended. Grid Nova refuses them from their next request.`)
  }
  if (access.invitation_revoked) lines.push('Their unused invitation was revoked — a new one has to be sent if they are reinstated.')
  if (access.clerk_unbanned) lines.push('Their sign-in works again.')
  if (access.clerk_error) {
    lines.push(
      `Clerk could not be updated (${access.clerk_error}). The change still stands: Grid Nova refuses a non-active associate on every request. Ask an Admin to check the Clerk dashboard.`
    )
  }
  if (lines.length === 0) lines.push('Their sign-in did not need changing.')
  return lines
}

const CODES: Record<string, string> = {
  associate_active: 'Only a suspended or deactivated associate’s customers can be moved. An active associate keeps their customers.',
  target_not_active: 'The associate you chose is not active. Choose an active associate.',
  same_associate: 'Choose a different associate — that is the same person.',
  reason_required: 'Please give a reason. It is recorded with each customer.',
  unknown_customers: 'Some of the customers are no longer this associate’s open customers. Refresh and try again.',
  nothing_to_move: 'This associate has no open customers left to move.',
  target_cannot_execute:
    'Some of these customers have execution run by the associate, and the associate you chose may not run execution. Switch those projects to Grid Nova execution first, or choose a Preferred Associate or an associate with execution capability.',
  invalid_transition: 'This can’t be done in the associate’s current state. Refresh the page.',
  seat_full: 'That territory seat is already filled.',
  no_approved_entries: 'There is no approved commission to pay for that month.',
}

export function staffAssociateError(err: unknown, fallback: string): string {
  if (isOutsideRegions(err)) return 'This associate is outside the regions you work in. Ask an Admin or a colleague who covers that region.'
  if (err instanceof ApiError) {
    const code = err.structuredDetail?.code
    if (typeof code === 'string' && CODES[code]) return CODES[code]
    if (err.status === 404) return 'That associate could not be found. Check the ID and try again.'
    if (err.status === 0) return 'Can’t reach the server. Check the connection and try again.'
    return err.detail || fallback
  }
  return err instanceof Error ? err.message : fallback
}

/** Customer ids named in a 409 / 422 answer (target_cannot_execute, unknown_customers). */
export function onboardingIdsOf(err: unknown): number[] {
  if (!(err instanceof ApiError)) return []
  const ids = err.structuredDetail?.onboarding_ids
  return Array.isArray(ids) ? ids.filter((n): n is number => typeof n === 'number') : []
}
