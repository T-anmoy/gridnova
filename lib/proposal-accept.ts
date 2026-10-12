import { ApiShapeError } from './dashboard/api-error'
import { proposalAcceptResponseSchema, formatZodError } from './dashboard/schemas'

// Pure helpers for the public proposal-accept page. Kept separate from the
// component so the response normalisation (which tolerates a few plausible
// backend field names) and the accepted-state check are unit-testable.
//
// Field names here are intentionally tolerant of multiple plausible backend
// shapes, but the canonical shape is the real one served by
// GET/POST /api/v1/proposals/accept/{token} (see backend
// app/api/routes/public_proposals.py `_summary()`):
//   scope is an ARRAY of {id, body} sections (composable content, not a
//   single string) — rendering it directly crashes React.
//   the GET response has no customer_name/company field at all today; the
//   POST (accept) response uses `status`, the GET (view) response uses
//   `state` for the equivalent concept ("acceptable" | "expired" | "accepted").

export interface AcceptView {
  id: number | null
  customerName: string | null
  company: string | null
  scope: string | null
  totalValue: number | null
  validUntil: string | null
  status: string | null
  acceptedAt: string | null
  pdfAvailable: boolean
}

export interface ScopeSection {
  id?: string | null
  body?: string | null
}

export interface RawAccept {
  id?: number | null
  proposal_id?: number | null
  version?: number | null
  status?: string | null
  state?: string | null
  accepted_at?: string | null
  valid_until?: string | null
  validity?: string | null
  total_value?: number | null
  price?: number | null
  customer_name?: string | null
  company?: string | null
  customer?: { name?: string | null; company?: string | null } | null
  scope?: string | ScopeSection[] | null
  scope_summary?: string | null
  scope_of_work?: string | null
  content?: { scope_of_work?: string | null } | null
  pdf_available?: boolean | null
}

function firstDefined<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null) return v
  return null
}

// The real backend sends `scope` as an array of composable sections
// ({id, body}), not a single string — join their bodies into display text.
// Still tolerates a plain string for the older/hypothetical shape.
function normalizeScope(scope: RawAccept['scope']): string | null {
  if (scope == null) return null
  if (typeof scope === 'string') return scope || null
  if (Array.isArray(scope)) {
    const joined = scope
      .map((section) => (section && typeof section === 'object' ? section.body : null))
      .filter((body): body is string => typeof body === 'string' && body.length > 0)
      .join('\n\n')
    return joined || null
  }
  return null
}

// Runtime shape check, run on the raw parsed JSON before normalisation.
// Throws ApiShapeError (naming the exact field) on a genuine contract break —
// e.g. `scope` arriving as something that isn't a string or an array of
// {id, body} sections, which is exactly the shape that crashed this page.
// Deliberately permissive elsewhere, matching normalizeAcceptResponse's own
// tolerance of multiple plausible field names.
export function validateAcceptResponse(raw: unknown): RawAccept {
  const parsed = proposalAcceptResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiShapeError('/api/v1/proposals/accept/{token}', formatZodError(parsed.error))
  }
  return parsed.data as RawAccept
}

export function normalizeAcceptResponse(raw: RawAccept | null | undefined): AcceptView {
  const r = raw ?? {}
  return {
    id: firstDefined(r.id, r.proposal_id),
    customerName: firstDefined(r.customer_name, r.customer?.name),
    company: firstDefined(r.company, r.customer?.company),
    scope: normalizeScope(r.scope) ?? firstDefined(r.scope_summary, r.scope_of_work, r.content?.scope_of_work),
    totalValue: firstDefined(r.total_value, r.price),
    validUntil: firstDefined(r.valid_until, r.validity),
    status: firstDefined(r.status, r.state),
    acceptedAt: firstDefined(r.accepted_at),
    pdfAvailable: r.pdf_available === true,
  }
}

export function isAccepted(v: AcceptView): boolean {
  return v.status === 'accepted' || v.acceptedAt != null
}

// The GET view endpoint reports expiry through the body (`state: "expired"`),
// not an HTTP status — the backend only 404s for an unknown token and never
// error-codes a merely-expired one on GET.
export function isExpired(v: AcceptView): boolean {
  return v.status === 'expired'
}

export type AcceptScreen =
  | 'loading'
  | 'ready'
  | 'accepted'
  | 'notfound'
  | 'expired'
  | 'superseded'
  | 'unavailable'
  | 'reverification'
  | 'error'

// Map an HTTP status from the GET/POST accept endpoints to a customer-safe
// screen — never a raw error/crash. Per the backend's accept_proposal
// handler, an already-accepted proposal is a 200 (idempotent success, see
// `already_accepted`). This is the fallback for a 409 with no recognised code.
export function screenForHttpStatus(httpStatus: number): AcceptScreen {
  if (httpStatus >= 200 && httpStatus < 300) return 'ready'
  if (httpStatus === 404) return 'notfound'
  if (httpStatus === 409) return 'expired'
  if (httpStatus === 410) return 'expired'
  return 'error'
}

// BE-1 §3 / BE-2: 409 bodies are `{detail: {code, message}}`. The codes decide
// the screen; an unrecognised code (or the old plain-string 409) keeps the
// previous "expired" mapping.
export function acceptErrorCode(body: unknown): string | null {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const code = (detail as { code?: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}

export function screenForAcceptError(httpStatus: number, body: unknown): AcceptScreen {
  if (httpStatus === 409) {
    switch (acceptErrorCode(body)) {
      case 'proposal_superseded':
        return 'superseded'
      case 'proposal_not_available':
        return 'unavailable'
      case 'proposal_expired':
        return 'expired'
      case 'needs_reverification':
        return 'reverification'
    }
  }
  return screenForHttpStatus(httpStatus)
}

/** The accept-screen for a valid 2xx view. */
export function screenForView(v: AcceptView): AcceptScreen {
  return isAccepted(v) ? 'accepted' : isExpired(v) ? 'expired' : 'ready'
}

/** The public PDF link; the token is a path segment, so it is always encoded. */
export function acceptPdfPath(token: string): string {
  return `/api/v1/public/proposals/${encodeURIComponent(token)}/pdf`
}

export function acceptApiPath(token: string): string {
  return `/api/v1/proposals/accept/${encodeURIComponent(token)}`
}
