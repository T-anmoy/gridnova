// BE-21 offboarding (docs/api/access_control.md §4): the database refuses a deactivated
// person at once; Clerk then ends their sessions (free plan) or bans them (Pro).
import type { DeactivateResponse } from '@/lib/access/types'

/**
 * BE-21: what Clerk did after the database cut the person off — every open session ended
 * (Clerk's free plan) or the user banned (Clerk Pro). The rest of the sentence after
 * "They are refused from their next click".
 */
export function clerkOutcome(r: Pick<DeactivateResponse, 'clerk_mode' | 'clerk_banned' | 'sessions_revoked' | 'clerk_error'>): string {
  if (r.clerk_error) return '.'
  if (r.clerk_mode === 'ban') return r.clerk_banned ? ', their sign-in is blocked and every open session has ended.' : '.'
  if (r.sessions_revoked === null) return '.'
  if (r.sessions_revoked === 0) return '; they had no open sessions.'
  return `, and ${r.sessions_revoked === 1 ? 'their open session has' : `all ${r.sessions_revoked} open sessions have`} been ended.`
}
