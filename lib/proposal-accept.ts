// Pure helpers for the public proposal-accept page. Kept separate from the
// component so the response normalisation (which tolerates a few plausible
// backend field names) and the accepted-state check are unit-testable.

export interface AcceptView {
  id: number | null
  customerName: string | null
  company: string | null
  scope: string | null
  totalValue: number | null
  validUntil: string | null
  status: string | null
  acceptedAt: string | null
}

export interface RawAccept {
  id?: number | null
  proposal_id?: number | null
  status?: string | null
  accepted_at?: string | null
  valid_until?: string | null
  validity?: string | null
  total_value?: number | null
  price?: number | null
  customer_name?: string | null
  company?: string | null
  customer?: { name?: string | null; company?: string | null } | null
  scope?: string | null
  scope_summary?: string | null
  scope_of_work?: string | null
  content?: { scope_of_work?: string | null } | null
}

function firstDefined<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null) return v
  return null
}

export function normalizeAcceptResponse(raw: RawAccept | null | undefined): AcceptView {
  const r = raw ?? {}
  return {
    id: firstDefined(r.id, r.proposal_id),
    customerName: firstDefined(r.customer_name, r.customer?.name),
    company: firstDefined(r.company, r.customer?.company),
    scope: firstDefined(r.scope, r.scope_summary, r.scope_of_work, r.content?.scope_of_work),
    totalValue: firstDefined(r.total_value, r.price),
    validUntil: firstDefined(r.valid_until, r.validity),
    status: firstDefined(r.status),
    acceptedAt: firstDefined(r.accepted_at),
  }
}

export function isAccepted(v: AcceptView): boolean {
  return v.status === 'accepted' || v.acceptedAt != null
}

export type AcceptScreen = 'loading' | 'ready' | 'accepted' | 'notfound' | 'expired' | 'error'

// Map an HTTP status from the GET/POST accept endpoints to a customer-safe
// screen — never a raw error/crash.
export function screenForHttpStatus(httpStatus: number): AcceptScreen {
  if (httpStatus >= 200 && httpStatus < 300) return 'ready'
  if (httpStatus === 404) return 'notfound'
  if (httpStatus === 409) return 'accepted' // already accepted / reused token
  if (httpStatus === 410) return 'expired'
  return 'error'
}
