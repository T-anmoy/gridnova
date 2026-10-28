// A refused application (422) lists every field error at once, each with a
// stable, language-free `code` (associate_journeys.md §1). The form shows each
// one beside its field in the reader's language; the API's English `msg` is
// only the fallback for a code this build does not know yet.
import { ApiError } from '@/lib/dashboard/api-error'

export type ApplyStep =
  | 'personal'
  | 'address'
  | 'territory'
  | 'business'
  | 'references'
  | 'identityBank'
  | 'capability'
  | 'documents'
  | 'consent'

/** The wizard step each submitted field is asked on. */
export const APPLY_FIELD_STEP: Record<string, ApplyStep> = {
  full_name: 'personal',
  date_of_birth: 'personal',
  mobile: 'personal',
  email: 'personal',
  address_line: 'address',
  state_lgd_code: 'address',
  district_lgd_code: 'address',
  block_lgd_code: 'address',
  pin_code: 'address',
  requested_level: 'territory',
  requested_state_lgd_code: 'territory',
  requested_district_lgd_code: 'territory',
  requested_block_lgd_code: 'territory',
  business_type: 'business',
  gstin: 'business',
  office_address: 'business',
  prior_experience: 'business',
  team_size: 'business',
  reference_1_name: 'references',
  reference_1_mobile: 'references',
  reference_2_name: 'references',
  reference_2_mobile: 'references',
  aadhaar_number: 'identityBank',
  pan: 'identityBank',
  bank_account_number: 'identityBank',
  bank_ifsc: 'identityBank',
  capability: 'capability',
  masked_aadhaar: 'documents',
  pan_card: 'documents',
  photo: 'documents',
  cancelled_cheque: 'documents',
  consent: 'consent',
}

// Both consent fields are one tick-box on the form.
const FIELD_ALIAS: Record<string, string> = { kyc_consent_accepted: 'consent', kyc_consent_version: 'consent' }

export interface ApplyFieldErrors {
  /** Form field → the sentence to show under it. */
  byField: Record<string, string>
  /** Sentences for errors that belong to no field on the form. */
  general: string[]
  /** True when the consent text the applicant accepted is no longer the current one. */
  consentStale: boolean
}

interface RawFieldError {
  loc?: unknown
  msg?: unknown
  code?: unknown
}

/** Reads a 422's field errors; null when the error is not one. */
export function applyFieldErrors(err: unknown, messages: Record<string, string>): ApplyFieldErrors | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null
  const items = err.structuredDetail?.fieldErrors
  if (!Array.isArray(items) || items.length === 0) return null
  const out: ApplyFieldErrors = { byField: {}, general: [], consentStale: false }
  for (const raw of items as RawFieldError[]) {
    const loc = Array.isArray(raw?.loc) ? raw.loc.filter((p) => p !== 'body') : []
    const name = typeof loc[loc.length - 1] === 'string' ? (loc[loc.length - 1] as string) : ''
    const field = FIELD_ALIAS[name] ?? name
    const code = typeof raw?.code === 'string' ? raw.code : ''
    if (code === 'consent_version_stale') out.consentStale = true
    const text = messages[code] ?? (typeof raw?.msg === 'string' && raw.msg ? raw.msg : messages.invalid)
    if (field && field in APPLY_FIELD_STEP) {
      // The first error for a field is the one to fix first; keep it.
      out.byField[field] ??= text
    } else {
      out.general.push(text)
    }
  }
  return out
}

/** The steps that hold an error, in the order the wizard asks them. */
export function stepsWithErrors(byField: Record<string, string>, steps: readonly string[]): string[] {
  const hit = new Set(Object.keys(byField).map((f) => APPLY_FIELD_STEP[f]))
  return steps.filter((s) => hit.has(s as ApplyStep))
}
