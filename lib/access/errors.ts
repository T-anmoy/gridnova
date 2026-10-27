import { ApiError } from '@/lib/dashboard/api-error'
import { rolesLine } from './roles'

// Every BE-17 error code (access_control.md §3–§5, §7) → one plain sentence. The new
// routes answer `{"detail": {"code", "message", …}}`; the older employee routes keep
// plain-string 403s for "your role cannot …", which fall through to the server's words.

export const ACCESS_ERROR_MESSAGES: Record<string, string> = {
  // Sign-in (§3)
  not_invited: 'Access to the Grid Nova dashboard is by invitation. Ask a Grid Nova Admin to invite you.',
  invitation_expired: 'Your invitation has expired. Ask a Grid Nova Admin to send a new one.',
  email_in_use: 'Another staff account already uses this email address. Ask a Grid Nova Admin to sort it out.',
  identity_check_unavailable: 'We could not confirm your email address just now. Try again in a minute.',
  // Invitations (§3)
  role_not_assignable: 'You can’t give those roles. Ask an Admin to do it.',
  already_staff: 'This person is already on the staff list.',
  invitation_exists: 'This email address already has a pending invitation. Resend that one instead.',
  invalid_email: 'That email address doesn’t look right.',
  invalid_name: 'Enter the person’s full name.',
  role_combination_not_supported: 'A person can hold only one of Sales, Engineer and Operations.',
  clerk_invitation_failed: 'The invitation email could not be sent. Nothing was saved — try again.',
  invitation_not_pending: 'This invitation has already been accepted or withdrawn.',
  // Roles and deactivation (§4)
  own_admin_role: 'You can’t remove your own Admin role. Ask another Admin to do it.',
  admin_floor: 'Grid Nova must always have at least two Admins.',
  employee_not_found: 'This person is no longer on the staff list. Refresh the page.',
  clerk_sync_failed: 'The sign-in service could not be updated, so nothing was changed. Try again.',
  self_deactivation: 'You can’t turn off your own access.',
  not_assignable: 'That person can’t take leads. Pick an active Admin or salesperson.',
  same_employee: 'Pick someone other than the person leaving.',
  unknown_region: 'One of those regions isn’t known. Refresh and pick again.',
  // Second approval (§5)
  self_approval: 'You asked for this change, so someone else has to approve it.',
  not_an_approver: 'You can’t approve this request.',
  approval_not_pending: 'This request has already been decided.',
  approval_expired: 'This request has expired. Ask for the change again.',
  approval_stale: 'This person’s roles changed after the request was made. Ask for the change again.',
  not_requester: 'Only the person who asked for this change can withdraw it.',
  // Two-step sign-in (§7)
  two_factor_required: 'This needs two-step verification. Turn it on in your account security settings, then try again.',
}

/** The deactivated-account refusal is still a plain string (§3, unchanged). */
export const DEACTIVATED_DETAIL = 'This account has been deactivated.'

export function accessErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null
  const code = err.structuredDetail?.code
  return typeof code === 'string' ? code : null
}

/** A plain sentence for any error from the access routes. */
export function accessErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const code = accessErrorCode(err)
  if (code === 'role_not_assignable') {
    // The refusal lists the roles outside your scope.
    const roles = (err as ApiError).structuredDetail?.roles
    if (Array.isArray(roles) && roles.length) return `You can’t give ${rolesLine(roles.map(String))}. Ask an Admin to do it.`
  }
  if (code && ACCESS_ERROR_MESSAGES[code]) return ACCESS_ERROR_MESSAGES[code]
  if (err instanceof ApiError) return err.detail || fallback
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export type SignInBlock = 'not_invited' | 'invitation_expired' | 'email_in_use' | 'identity_check_unavailable' | 'deactivated'

/** Why GET /employees/me refused the signed-in person, or null when it is another error. */
export function signInBlockOf(err: unknown): SignInBlock | null {
  if (!(err instanceof ApiError)) return null
  const code = accessErrorCode(err)
  if (code === 'not_invited' || code === 'invitation_expired' || code === 'email_in_use' || code === 'identity_check_unavailable') return code
  if (err.status === 403 && (err.detail ?? '').trim() === DEACTIVATED_DETAIL) return 'deactivated'
  return null
}

export function isTwoFactorRequired(err: unknown): boolean {
  return accessErrorCode(err) === 'two_factor_required'
}
