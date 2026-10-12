import { ApiError } from '@/lib/dashboard/api-error'
import type { SurveyReviewOutcome } from '@/lib/associate/survey-types'

// Plain sentences for the survey-review endpoints' business errors (BE-2 §5).
// Staff copy is English; the associate side has its own translated map.

export const OUTCOME_LABEL: Record<SurveyReviewOutcome, string> = {
  feasible: 'Feasible',
  feasible_with_conditions: 'Feasible with conditions',
  revisit_needed: 'Revisit needed',
  not_feasible: 'Not feasible',
}

export const OUTCOME_VARIANT: Record<SurveyReviewOutcome, 'green' | 'blue' | 'amber' | 'red'> = {
  feasible: 'green',
  feasible_with_conditions: 'blue',
  revisit_needed: 'amber',
  not_feasible: 'red',
}

const MESSAGES: Record<string, string> = {
  survey_not_submitted: 'The customer has not submitted the survey yet, so it cannot be reviewed.',
  survey_incomplete: 'The survey is incomplete or unsigned, so it cannot be reviewed yet.',
  notes_required: 'Notes are required for this outcome.',
  conditions_required: 'Add at least one condition.',
  revisit_items_required: 'Add at least one revisit item.',
  not_applicable: 'Conditions and revisit items do not apply to this outcome.',
  note_required: 'A note is required.',
  too_long: 'One of the entries is too long.',
  review_required: 'Record the feasibility review first; the report is built from it.',
  storage_not_configured: 'File storage is not configured, so the report cannot be created or downloaded right now.',
  report_not_generated: 'No report has been generated yet.',
  correction_not_found: 'That correction request could not be found.',
  correction_not_pending: 'Someone else has already decided this request.',
  segregation_of_duties: 'You cannot decide a request you made or applied yourself. Ask a colleague.',
  not_editable: 'This customer is closed, so the survey can no longer change.',
  survey_review_required: 'The engineer’s feasibility review is required (and must be current) before a formal proposal can be prepared.',
  survey_not_feasible: 'The engineer found this site not feasible, so no proposal can be prepared.',
  not_flagged: 'This proposal is not flagged for re-verification (anymore).',
}

const FIELD_LABELS: Record<string, string> = {
  roof_sections: 'roof sections',
  roof_area_sqft: 'roof area',
  shadow_free_area_sqft: 'shadow-free area',
  sanctioned_load_kw: 'sanctioned load',
  connection_phase: 'connection phase',
  survey_variant: 'survey type',
  consumption_history: 'bill history',
  avg_monthly_units_kwh: 'average monthly units',
  avg_monthly_bill_inr: 'average monthly bill',
  desired_output_kw: 'desired system size',
}

/** "roof area, sanctioned load" — never a raw key when one is known. */
export function fieldList(fields: unknown): string {
  if (!Array.isArray(fields)) return ''
  return fields.map((f) => FIELD_LABELS[String(f)] ?? String(f).replace(/_/g, ' ')).join(', ')
}

/** One plain sentence for any failed survey-review call. Never an object. */
export function surveyReviewError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(err instanceof ApiError)) return err instanceof Error && err.message ? err.message : fallback
  const d = err.structuredDetail
  const code = d && !Array.isArray(d) && typeof d.code === 'string' ? d.code : null
  if (code === 'needs_reverification') {
    const fields = fieldList(d?.fields)
    return `Survey details that affect this proposal changed${fields ? ` (${fields})` : ''}. It must be re-verified before it goes to the customer.`
  }
  if (code === 'survey_incomplete') {
    const sections = Array.isArray(d?.missing_survey_sections) ? (d.missing_survey_sections as string[]).map((x) => x.replace(/_/g, ' ')) : []
    const unsigned = Array.isArray(d?.survey_unsigned) ? (d.survey_unsigned as string[]) : []
    const extra = [sections.length ? `Missing: ${sections.join(', ')}.` : '', unsigned.length ? `Unsigned: ${unsigned.join(', ')}.` : ''].filter(Boolean).join(' ')
    return `${MESSAGES.survey_incomplete}${extra ? ' ' + extra : ''}`
  }
  if (code === 'unknown_section' || code === 'unknown_field') return 'One revisit item points at a section or field that does not exist.'
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (err.status === 0) return 'Can’t reach the server. Check your connection and try again.'
  if (err.status === 403) return 'You don’t have permission to do this.'
  return err.detail && typeof err.detail === 'string' ? err.detail : fallback
}

/** Roles the survey endpoints let in (BE-2 §7). Operations and accounts get 403. */
export const SURVEY_READER_ROLES = ['admin', 'management', 'sales', 'engineer'] as const
/** Roles that may record a review, generate a report and decide corrections. */
export const SURVEY_REVIEWER_ROLES = ['admin', 'engineer'] as const
/** Roles that may clear a proposal's re-verification flag. */
export const REVERIFY_CLEAR_ROLES = ['admin', 'management', 'engineer'] as const

export const isSurveyReader = (role: string | undefined) => !!role && (SURVEY_READER_ROLES as readonly string[]).includes(role)
export const isSurveyReviewer = (role: string | undefined) => !!role && (SURVEY_REVIEWER_ROLES as readonly string[]).includes(role)
export const canClearReverification = (role: string | undefined) => !!role && (REVERIFY_CLEAR_ROLES as readonly string[]).includes(role)

/**
 * Fields a revisit item may name, per survey section (the backend accepts any
 * field its section can hold in any variant or condition — site_survey.md §8).
 * The section keys themselves come from the survey status, never free text.
 */
export const REVISIT_FIELDS: Record<string, readonly string[]> = {
  connection: ['discom', 'consumer_number', 'connection_phase', 'sanctioned_load_kw', 'society_flat_count', 'society_noc_status', 'contract_demand_kva'],
  bills: ['consumption_history'],
  roof: ['roof_accessible', 'roof_material', 'roof_material_other', 'roof_orientation', 'roof_ownership_confirmed', 'tenant_noc_available', 'floors', 'shading_condition', 'roof_obstacles'],
  roof_area: ['roof_area_sqft', 'shadow_free_area_sqft', 'roof_sections'],
  layout: ['inverter_location', 'indoor_wall_available', 'water_available', 'distance_panel_to_inverter_m', 'distance_inverter_to_lt_panel_m', 'distance_method'],
}

export const humanize = (key: string) => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** A survey value for a before → after diff: plain words, never raw JSON for the common shapes. */
export function formatChangeValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number' || typeof v === 'string') return String(v).replace(/_/g, ' ')
  if (Array.isArray(v)) {
    if (v.length === 0) return 'None'
    return v
      .map((x) => {
        if (x && typeof x === 'object') {
          const o = x as Record<string, unknown>
          if ('month' in o) return `${o.month}: ${o.units_kwh ?? '—'} kWh${o.bill_inr != null ? `, ₹${o.bill_inr}` : ''}`
          if ('length_m' in o) return `${o.label ?? 'Section'}: ${o.length_m} × ${o.width_m} m${o.obstacle_area_sqm ? ` (−${o.obstacle_area_sqm} m²)` : ''}`
          return Object.values(o).join(' ')
        }
        return String(x).replace(/_/g, ' ')
      })
      .join('; ')
  }
  return JSON.stringify(v)
}
