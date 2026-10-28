// One way to turn any failed portal call into a plain sentence in the reader's
// language. The backend's English `detail` never reaches the screen: a known
// `code` gets its own sentence, anything else a sentence for its kind of failure
// (offline, server, not found, …).
import { ApiError, isMissingClaimsError, wrongAccountOf } from '@/lib/dashboard/api-error'
import { isNotAuthenticatedError } from '@/lib/api/http'
import type { Messages } from '@/lib/i18n/types'

export type PortalFeedback = Messages['portalFeedback']

export type PortalFailure =
  | 'offline'
  | 'network'
  | 'server'
  | 'rateLimited'
  | 'auth'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'invalid'
  | 'generic'

export type AccountState = 'suspended' | 'deactivated'

// README.md "401 vs 403": an inactive associate is refused on every associate
// route with `"This associate account is suspended."` (or deactivated).
const INACTIVE_ACCOUNT = /^This associate account is (\w+)\.$/

/** The account state behind a refusal, when the refusal is "your account is not active". */
export function inactiveAccountOf(error: unknown): AccountState | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null
  const m = INACTIVE_ACCOUNT.exec((error.detail ?? '').trim())
  if (!m) return null
  return m[1] === 'suspended' ? 'suspended' : 'deactivated'
}

/** The structured `code` of an error body, when it has one. */
export function errorCodeOf(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  const code = error.structuredDetail?.code
  return typeof code === 'string' && code ? code : null
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function failureOf(error: unknown): PortalFailure {
  if (!(error instanceof ApiError)) return isOffline() ? 'offline' : 'generic'
  if (error.status === 0) return isOffline() ? 'offline' : 'network'
  if (error.status === 401 || isNotAuthenticatedError(error)) return 'auth'
  if (error.status === 429) return 'rateLimited'
  if (error.status >= 500) return 'server'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  if (error.status === 409) return 'conflict'
  if (error.status === 400 || error.status === 422) return 'invalid'
  return 'generic'
}

/**
 * The sentence for a failed action. `specific` is the feature's own code map
 * (payments, execution, …), checked first; then the portal's common codes;
 * then the kind of failure.
 */
export function portalErrorText(error: unknown, copy: PortalFeedback, specific?: Record<string, string>): string {
  const account = inactiveAccountOf(error)
  if (account) return copy.account[account].title
  if (isMissingClaimsError(error)) return copy.codes.session_token_missing_claims
  if (wrongAccountOf(error)) return copy.action.forbidden
  const code = errorCodeOf(error)
  const codes = copy.codes as Record<string, string>
  if (code && specific?.[code]) return specific[code]
  if (code && codes[code]) return codes[code]
  return copy.action[failureOf(error)]
}
