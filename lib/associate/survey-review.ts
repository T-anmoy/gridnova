// Associate-side helpers for the engineer's review, corrections and report
// (site_survey.md §8–§10). Pure and translated: API codes are mapped to the
// viewer's language here, never shown as the raw English `message`.
import { ApiError, isMissingClaimsError } from '@/lib/dashboard/api-error'
import { stepOfSection, type SurveyStepKey } from './survey'
import type { CorrectionErrorCode, SignatureParty, SurveyStatus } from './survey-types'

export type { SurveyStepKey }

/** Every wizard step a revisit item can send the associate to (the survey step is the fallback). */
export type RevisitStep = SurveyStepKey | 'survey'

export function revisitStep(section: string): RevisitStep {
  return stepOfSection(section) ?? 'survey'
}

export const WIZARD_DEEP_STEPS: readonly RevisitStep[] = ['connection', 'bills', 'house', 'layout', 'survey']
export const asDeepStep = (s: string | undefined): RevisitStep | undefined => (WIZARD_DEEP_STEPS as readonly string[]).includes(s ?? '') ? (s as RevisitStep) : undefined

/** The wizard/edit URL for a deep link. */
export const editStepHref = (portalBase: string, onboardingId: number, step: RevisitStep) => `${portalBase}/customers/${onboardingId}/edit?step=${step}`
export const correctionHref = (portalBase: string, onboardingId: number) => `${portalBase}/customers/${onboardingId}/survey-correction`

const code = (err: unknown): string | null => {
  if (!(err instanceof ApiError)) return null
  const d = err.structuredDetail
  return d && !Array.isArray(d) && typeof d.code === 'string' ? d.code : null
}

/** `not_feasible` blocks a formal proposal whatever the config — the one refusal the client can know for certain. */
export const proposalGateRefuses = (status: SurveyStatus | undefined): boolean => status?.review?.outcome === 'not_feasible'

/** 409 `survey_review_required` / `survey_not_feasible` on the formal-proposal request, else null. */
export function proposalGateCode(err: unknown): 'review_required' | 'survey_not_feasible' | null {
  const c = code(err)
  if (c === 'survey_review_required') return 'review_required'
  if (c === 'survey_not_feasible') return 'survey_not_feasible'
  return null
}

/** 409 `needs_reverification` on the in-person acceptance (no field names for the associate). */
export const isNeedsReverification = (err: unknown) => code(err) === 'needs_reverification'

/** Parties whose signature is missing on a survey that is otherwise complete. */
export function unsignedParties(status: SurveyStatus): SignatureParty[] {
  return (['customer', 'associate'] as const).filter((p) => !status.signatures[p].signed)
}

/**
 * A verified customer re-signs only after a correction cleared a signature: the
 * survey is complete, required, not grandfathered, and a party is unsigned.
 */
export function canResignVerified(status: SurveyStatus | undefined, onboardingStatus: string): boolean {
  return !!status && onboardingStatus === 'verified' && !status.grandfathered && status.required_to_submit && status.complete && unsignedParties(status).length > 0
}

export interface CorrectionErrorCopy extends Partial<Record<CorrectionErrorCode | 'offline' | 'generic', string>> {
  generic: string
  offline: string
}

export function correctionErrorText(err: unknown, copy: CorrectionErrorCopy, missingClaims?: string): string {
  if (isMissingClaimsError(err)) return missingClaims ?? copy.generic
  if (err instanceof ApiError && err.status === 0) return copy.offline
  const c = code(err)
  if (c && copy[c as CorrectionErrorCode]) return copy[c as CorrectionErrorCode] as string
  return copy.generic
}

export function reportErrorText(err: unknown, copy: Record<string, string>): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return copy.forbidden
    const c = code(err)
    if (c && copy[c]) return copy[c]
  }
  return copy.generic
}

export interface ValueCopy {
  yes: string
  no: string
  fields: Record<string, string>
  maps: Record<string, Record<string, string>>
}

const MAP_OF: Record<string, string> = {
  roof_material: 'roofMaterials',
  roof_orientation: 'orientations',
  connection_phase: 'phases',
  shading_condition: 'shading',
  society_noc_status: 'nocStatuses',
  inverter_location: 'inverterLocations',
  distance_method: 'methods',
  survey_variant: 'variants',
  roof_obstacles: 'obstacles',
}

/** A survey value in the viewer's language (bool → yes/no, enums → their labels, lists → short lines). */
export function displayValue(field: string, v: unknown, c: ValueCopy): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? c.yes : c.no
  const map = c.maps[MAP_OF[field] ?? '']
  const word = (x: unknown) => (map && typeof x === 'string' && map[x]) || String(x).replace(/_/g, ' ')
  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    return v
      .map((x) => {
        if (x && typeof x === 'object') {
          const o = x as Record<string, unknown>
          if ('month' in o) return `${o.month}: ${o.units_kwh ?? '—'} kWh${o.bill_inr != null ? `, ₹${o.bill_inr}` : ''}`
          if ('length_m' in o) return `${o.label ?? ''} ${o.length_m} × ${o.width_m} m`.trim()
          return Object.values(o).join(' ')
        }
        return word(x)
      })
      .join('; ')
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return word(v)
}
