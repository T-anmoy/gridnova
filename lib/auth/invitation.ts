// Clerk invitation sign-up (FE-17 §8). An invitation link lands on the redirect page with
// `__clerk_ticket` (the invitation token) and `__clerk_status` (`sign_up`, `sign_in` when the
// address already has an account, or `complete`) — Clerk "Invite users to your application"
// and the custom-flow guide "Application invitations", which completes the sign-up with
// `signUp.ticket()` and then `finalize()`. The prebuilt <SignUp /> also reads the ticket from
// the URL (it is one of the query parameters @clerk/shared forwards and strips on completion).

export const TICKET_PARAM = '__clerk_ticket'
export const STATUS_PARAM = '__clerk_status'

export type InvitationEntry =
  | { kind: 'no_ticket' } // no link: the open sign-up (BE-21 — the backend is the gate)
  | { kind: 'sign_in'; ticket: string } // the invited address already has an account
  | { kind: 'sign_up'; ticket: string }

type Params = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function invitationEntry(params: Params): InvitationEntry {
  const ticket = first(params[TICKET_PARAM])?.trim()
  if (!ticket) return { kind: 'no_ticket' }
  return first(params[STATUS_PARAM]) === 'sign_in' ? { kind: 'sign_in', ticket } : { kind: 'sign_up', ticket }
}

/** The sign-in URL that carries the ticket on, so Clerk's <SignIn /> completes the invitation. */
export function signInWithTicket(signInPath: string, ticket: string): string {
  return `${signInPath}?${TICKET_PARAM}=${encodeURIComponent(ticket)}`
}

/** A Clerk error's first code: a ClerkError has `code`, an API response error `errors[0].code`. */
export function clerkErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { code?: unknown; errors?: { code?: unknown }[] }
  if (typeof e.errors?.[0]?.code === 'string') return e.errors[0].code
  return typeof e.code === 'string' ? e.code : null
}

/** The address already has an account (or is signed in): send them to sign in, not to an error. */
export function isAlreadyRegistered(code: string | null): boolean {
  return code === 'form_identifier_exists' || code === 'identifier_already_signed_in' || code === 'session_exists'
}
