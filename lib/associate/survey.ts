// Pure helpers for the site survey inside the onboarding wizard: the survey
// form state, its conversion to and from the server's `site_assessment`, the
// PATCH diff, bill-row checks, step mapping and translated warnings.
// The server stays the authority (site_survey.md §1): these checks only give
// instant feedback, and every derived value (shadow-free area, averages,
// sizing) is shown from the server's response, never computed here.
import { ApiError } from '@/lib/dashboard/api-error'
import { fmt } from '@/lib/i18n/types'
import { formatInr } from '@/lib/money'
import type {
  ConsumptionMonth,
  SurveyFieldError,
  SurveyOptions,
  SurveySectionKey,
  SurveyVariant,
  SurveyWarning,
} from './survey-types'

export type YesNo = '' | 'yes' | 'no'

export interface BillRow {
  month: string
  units: string
  bill: string
}

export interface SectionRow {
  label: string
  length: string
  width: string
  obstacle: string
}

export interface SurveyForm {
  survey_variant: SurveyVariant
  society_flat_count: string
  society_noc_status: string
  contract_demand_kva: string
  discom_choice: string
  discom_other: string
  consumer_number: string
  connection_phase: string
  sanctioned_load_kw: string
  bills: BillRow[]
  roof_accessible: YesNo
  roof_access_note: string
  roof_material: string
  roof_material_other: string
  roof_orientation: string
  /** `null` = not surveyed yet; `[]` = surveyed, no obstacles. */
  roof_obstacles: string[] | null
  roof_ownership_confirmed: YesNo
  tenant_noc_available: YesNo
  floors: string
  shading_condition: string
  roof_area_sqft: string
  /** Sections → the server derives the shadow-free area; direct → typed in. Never both (422 `derived_field`). */
  area_mode: 'sections' | 'direct'
  roof_sections: SectionRow[]
  shadow_free_area_sqft: string
  roofs_available_count: string
  roofs_considered_count: string
  future_roof_expansion_planned: YesNo
  inverter_location: string
  indoor_wall_available: YesNo
  water_available: YesNo
  distance_panel_to_inverter_m: string
  distance_inverter_to_lt_panel_m: string
  distance_method: string
}

export const EMPTY_SURVEY_FORM: SurveyForm = {
  survey_variant: 'individual_house',
  society_flat_count: '',
  society_noc_status: '',
  contract_demand_kva: '',
  discom_choice: '',
  discom_other: '',
  consumer_number: '',
  connection_phase: '',
  sanctioned_load_kw: '',
  bills: [],
  roof_accessible: '',
  roof_access_note: '',
  roof_material: '',
  roof_material_other: '',
  roof_orientation: '',
  roof_obstacles: null,
  roof_ownership_confirmed: '',
  tenant_noc_available: '',
  floors: '',
  shading_condition: '',
  roof_area_sqft: '',
  area_mode: 'sections',
  roof_sections: [],
  shadow_free_area_sqft: '',
  roofs_available_count: '',
  roofs_considered_count: '',
  future_roof_expansion_planned: '',
  inverter_location: '',
  indoor_wall_available: '',
  water_available: '',
  distance_panel_to_inverter_m: '',
  distance_inverter_to_lt_panel_m: '',
  distance_method: '',
}

// ── Which wizard step holds which server field ────────────────────────────

export type SurveyStepKey = 'connection' | 'bills' | 'house' | 'layout'

export const STEP_FIELDS: Record<SurveyStepKey, readonly string[]> = {
  connection: [
    'survey_variant',
    'society_flat_count',
    'society_noc_status',
    'contract_demand_kva',
    'discom',
    'consumer_number',
    'connection_phase',
    'sanctioned_load_kw',
  ],
  bills: ['consumption_history'],
  house: [
    'roof_accessible',
    'roof_access_note',
    'roof_material',
    'roof_material_other',
    'roof_orientation',
    'roof_obstacles',
    'roof_ownership_confirmed',
    'tenant_noc_available',
    'floors',
    'shading_condition',
    'roof_area_sqft',
    'roof_sections',
    'shadow_free_area_sqft',
    'roofs_available_count',
    'roofs_considered_count',
    'future_roof_expansion_planned',
  ],
  // The server groups water and the indoor wall under `layout` (config sections),
  // so they live here — a "missing" deep link then lands on the right step.
  layout: [
    'inverter_location',
    'indoor_wall_available',
    'water_available',
    'distance_panel_to_inverter_m',
    'distance_inverter_to_lt_panel_m',
    'distance_method',
  ],
}

export const ALL_SURVEY_FIELDS: readonly string[] = Object.values(STEP_FIELDS).flat()

export function stepOfField(field: string): SurveyStepKey | null {
  for (const [step, fields] of Object.entries(STEP_FIELDS) as [SurveyStepKey, readonly string[]][]) {
    if (fields.includes(field)) return step
  }
  return null
}

const SECTION_STEP: Record<string, SurveyStepKey> = {
  connection: 'connection',
  bills: 'bills',
  roof: 'house',
  roof_area: 'house',
  layout: 'layout',
}

/** The wizard step a survey section (§3 / §6) is filled on; unknown sections fall back to their first missing field. */
export function stepOfSection(section: SurveySectionKey, missing: string[] = []): SurveyStepKey | null {
  if (section in SECTION_STEP) return SECTION_STEP[section]
  for (const f of missing) {
    const s = stepOfField(f)
    if (s) return s
  }
  return null
}

// ── Server ↔ form ─────────────────────────────────────────────────────────

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const yn = (v: unknown): YesNo => (v === true ? 'yes' : v === false ? 'no' : '')

/** Decimal strings ("10.00") and numbers both become the shortest plain form ("10"). */
function numStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? String(n) : String(v)
}

export function surveyFormFromSiteAssessment(sa: Record<string, unknown> | null | undefined, discomOptions: string[] = []): SurveyForm {
  if (!sa) return { ...EMPTY_SURVEY_FORM }
  const discom = str(sa.discom)
  const known = discomOptions.filter((d) => d !== 'Other')
  const sections = Array.isArray(sa.roof_sections) ? (sa.roof_sections as Record<string, unknown>[]) : []
  const history = Array.isArray(sa.consumption_history) ? (sa.consumption_history as Record<string, unknown>[]) : []
  const variant = str(sa.survey_variant)
  return {
    survey_variant: (['individual_house', 'housing_society', 'commercial_roof'].includes(variant) ? variant : 'individual_house') as SurveyVariant,
    society_flat_count: numStr(sa.society_flat_count),
    society_noc_status: str(sa.society_noc_status),
    contract_demand_kva: numStr(sa.contract_demand_kva),
    discom_choice: !discom ? '' : known.includes(discom) ? discom : 'Other',
    discom_other: discom && !known.includes(discom) ? discom : '',
    consumer_number: str(sa.consumer_number),
    connection_phase: str(sa.connection_phase),
    sanctioned_load_kw: numStr(sa.sanctioned_load_kw),
    bills: history.map((h) => ({ month: str(h.month), units: numStr(h.units_kwh), bill: numStr(h.bill_inr) })),
    roof_accessible: yn(sa.roof_accessible),
    roof_access_note: str(sa.roof_access_note),
    roof_material: str(sa.roof_material),
    roof_material_other: str(sa.roof_material_other),
    roof_orientation: str(sa.roof_orientation),
    roof_obstacles: Array.isArray(sa.roof_obstacles) ? (sa.roof_obstacles as string[]) : null,
    roof_ownership_confirmed: yn(sa.roof_ownership_confirmed),
    tenant_noc_available: yn(sa.tenant_noc_available),
    floors: numStr(sa.floors),
    shading_condition: str(sa.shading_condition),
    roof_area_sqft: numStr(sa.roof_area_sqft),
    area_mode: sections.length > 0 || sa.shadow_free_area_sqft == null ? 'sections' : 'direct',
    roof_sections: sections.map((r) => ({ label: str(r.label), length: numStr(r.length_m), width: numStr(r.width_m), obstacle: numStr(r.obstacle_area_sqm) })),
    shadow_free_area_sqft: sections.length > 0 ? '' : numStr(sa.shadow_free_area_sqft),
    roofs_available_count: numStr(sa.roofs_available_count),
    roofs_considered_count: numStr(sa.roofs_considered_count),
    future_roof_expansion_planned: yn(sa.future_roof_expansion_planned),
    inverter_location: str(sa.inverter_location),
    indoor_wall_available: yn(sa.indoor_wall_available),
    water_available: yn(sa.water_available),
    distance_panel_to_inverter_m: numStr(sa.distance_panel_to_inverter_m),
    distance_inverter_to_lt_panel_m: numStr(sa.distance_inverter_to_lt_panel_m),
    distance_method: str(sa.distance_method),
  }
}

const numOrNull = (v: string): number | null => {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const boolOrNull = (v: YesNo): boolean | null => (v === 'yes' ? true : v === 'no' ? false : null)
const textOrNull = (v: string): string | null => (v.trim() ? v.trim() : null)

// A row with only a month is a prompt (the wizard pre-fills recent months): it
// counts, and is sent, only once units or a bill amount is typed.
const filledBill = (b: BillRow) => !!(b.units.trim() || b.bill.trim())
const filledSection = (r: SectionRow) => !!(r.label.trim() || r.length.trim() || r.width.trim() || r.obstacle.trim())

/** Every survey field as the PATCH body would carry it (numbers, never strings — §1). */
export function surveyPayload(form: SurveyForm): Record<string, unknown> {
  const sections = form.area_mode === 'sections' ? form.roof_sections.filter(filledSection) : []
  const bills = form.bills
    .filter(filledBill)
    .map((b): ConsumptionMonth => {
      const bill = numOrNull(b.bill)
      return { month: b.month.trim(), units_kwh: numOrNull(b.units), ...(bill !== null ? { bill_inr: bill } : {}) }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
  const out: Record<string, unknown> = {
    survey_variant: form.survey_variant,
    society_flat_count: form.survey_variant === 'housing_society' ? numOrNull(form.society_flat_count) : null,
    society_noc_status: form.survey_variant === 'housing_society' ? textOrNull(form.society_noc_status) : null,
    contract_demand_kva: form.survey_variant === 'commercial_roof' ? numOrNull(form.contract_demand_kva) : null,
    discom: form.discom_choice === 'Other' ? textOrNull(form.discom_other) : textOrNull(form.discom_choice),
    consumer_number: textOrNull(form.consumer_number),
    connection_phase: textOrNull(form.connection_phase),
    sanctioned_load_kw: numOrNull(form.sanctioned_load_kw),
    consumption_history: bills,
    roof_accessible: boolOrNull(form.roof_accessible),
    roof_access_note: textOrNull(form.roof_access_note),
    roof_material: textOrNull(form.roof_material),
    roof_material_other: form.roof_material === 'other' ? textOrNull(form.roof_material_other) : null,
    roof_orientation: textOrNull(form.roof_orientation),
    roof_obstacles: form.roof_obstacles,
    roof_ownership_confirmed: boolOrNull(form.roof_ownership_confirmed),
    tenant_noc_available: boolOrNull(form.tenant_noc_available),
    floors: numOrNull(form.floors),
    shading_condition: textOrNull(form.shading_condition),
    roof_area_sqft: numOrNull(form.roof_area_sqft),
    roof_sections: sections.map((r) => ({
      label: r.label.trim(),
      length_m: numOrNull(r.length),
      width_m: numOrNull(r.width),
      obstacle_area_sqm: numOrNull(r.obstacle),
    })),
    roofs_available_count: numOrNull(form.roofs_available_count),
    roofs_considered_count: numOrNull(form.roofs_considered_count),
    future_roof_expansion_planned: boolOrNull(form.future_roof_expansion_planned),
    inverter_location: textOrNull(form.inverter_location),
    indoor_wall_available: boolOrNull(form.indoor_wall_available),
    water_available: boolOrNull(form.water_available),
    distance_panel_to_inverter_m: numOrNull(form.distance_panel_to_inverter_m),
    distance_inverter_to_lt_panel_m: numOrNull(form.distance_inverter_to_lt_panel_m),
    distance_method: textOrNull(form.distance_method),
  }
  // Shadow-free area is server-derived whenever there are sections: never send it then.
  if (form.area_mode === 'direct') out.shadow_free_area_sqft = numOrNull(form.shadow_free_area_sqft)
  return out
}

/**
 * Only the fields (of `fields`) whose value differs from the server's — an
 * unchanged field is never re-sent, so an untouched step neither clears the
 * signatures (§1) nor returns a submitted customer to draft.
 */
export function surveyPatch(form: SurveyForm, server: SurveyForm, fields: readonly string[]): Record<string, unknown> {
  const mine = surveyPayload(form)
  const theirs = surveyPayload(server)
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (!(f in mine)) continue
    // Normalise "no sections" to [] on both sides; `null` and `[]` both clear (§1).
    if (JSON.stringify(mine[f] ?? null) !== JSON.stringify(theirs[f] ?? null)) out[f] = mine[f]
  }
  return out
}

/**
 * A patch that clears stored sections AND sets a direct shadow-free area would
 * be refused (422 `derived_field`, "while sections are stored"): split it into
 * two requests, sections first.
 */
export function splitDerivedPatch(patch: Record<string, unknown>, server: SurveyForm): Record<string, unknown>[] {
  if (!('shadow_free_area_sqft' in patch) || server.roof_sections.length === 0) return [patch]
  const { shadow_free_area_sqft, ...rest } = patch
  return [{ ...rest, roof_sections: [] }, { shadow_free_area_sqft }]
}

// ── Bills ─────────────────────────────────────────────────────────────────

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

/** The current month in IST as YYYY-MM (the server's "future" is IST, §1). */
export function currentIstMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return `${y}-${m}`
}

export type BillProblem = 'invalid_month' | 'future_month' | 'duplicate_month' | 'units_required' | 'invalid_number'

/** Per-row problems, keyed by row index; blank rows are ignored (they are never sent). */
export function validateBills(rows: BillRow[], now: Date = new Date()): Record<number, BillProblem[]> {
  const out: Record<number, BillProblem[]> = {}
  const nowMonth = currentIstMonth(now)
  const seen = new Map<string, number>()
  rows.forEach((r, i) => {
    if (!filledBill(r)) return
    const p: BillProblem[] = []
    const m = r.month.trim()
    const match = MONTH.exec(m)
    if (!match || Number(match[1]) < 2000) p.push('invalid_month')
    else if (m > nowMonth) p.push('future_month')
    else if (seen.has(m)) p.push('duplicate_month')
    if (match) seen.set(m, i)
    if (!r.units.trim()) p.push('units_required')
    const bad = (v: string) => v.trim() !== '' && !(Number.isFinite(Number(v)) && Number(v) >= 0)
    if (bad(r.units) || bad(r.bill)) p.push('invalid_number')
    if (p.length) out[i] = p
  })
  return out
}

export const filledBillCount = (rows: BillRow[]) => rows.filter(filledBill).length

/** The `count` months before the current IST month, newest first — prompts for the requested bills (the current month's bill rarely exists yet). */
export function recentMonths(count: number, now: Date = new Date()): string[] {
  const [y, m] = currentIstMonth(now).split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 2 - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

// ── Number checks shared by the roof and layout steps ─────────────────────

export type NumberProblem = 'invalid_number' | 'out_of_range' | 'roofs_considered_exceeds_available' | 'obstacle_exceeds_section'

/** Format-only checks for non-negative numbers (`max` inclusive). */
export function numberProblem(v: string, { min = 0, max, integer = false, exclusiveMin = false }: { min?: number; max?: number; integer?: boolean; exclusiveMin?: boolean } = {}): NumberProblem | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n)) || (exclusiveMin ? n <= min : n < min)) return 'invalid_number'
  if (max !== undefined && n > max) return 'out_of_range'
  return null
}

// ── Required fields (for marking, not blocking) ───────────────────────────

/** The fields the server will require for this variant, including conditional ones that apply now (§2/§3). */
export function requiredSurveyFields(options: SurveyOptions, form: SurveyForm): Set<string> {
  const out = new Set<string>()
  for (const s of options.variants[form.survey_variant] ?? []) for (const f of s.fields) out.add(f)
  const payload = surveyPayload(form)
  for (const c of options.conditional) {
    if (Object.entries(c.when).every(([k, v]) => payload[k] === v)) for (const f of c.require) out.add(f)
  }
  return out
}

/** Whether a conditional field is asked for now (e.g. tenant NOC only when the roof isn't owned). */
export function conditionalApplies(options: SurveyOptions, form: SurveyForm, field: string): boolean {
  const payload = surveyPayload(form)
  return options.conditional.some((c) => c.require.includes(field) && Object.entries(c.when).every(([k, v]) => payload[k] === v))
}

// ── Errors ────────────────────────────────────────────────────────────────

/** A structured §1 survey 422 (`{code, field, index?}`), or null for anything else. */
export function surveyFieldErrorOf(err: unknown): SurveyFieldError | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null
  const d = err.structuredDetail
  if (!d || Array.isArray(d) || typeof d.code !== 'string') return null
  return d as unknown as SurveyFieldError
}

// ── Warnings (§4: code + params only, never English) ──────────────────────

function paramText(key: string, v: unknown, limitingCopy: Record<string, string>): string {
  if (v === null || v === undefined) return '—'
  if (key === 'limiting_factor') return limitingCopy[String(v)] ?? String(v)
  if (key === 'implied_tariff_inr_per_kwh' || key === 'min' || key === 'max') return formatInr(String(v))
  if (typeof v === 'number') return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)
  return String(v)
}

/**
 * The translated sentence for a warning. Unknown codes get the generic
 * template — never the raw code or English from elsewhere.
 */
export function surveyWarningText(
  w: SurveyWarning,
  copy: { warnings: Record<string, string>; limiting: Record<string, string>; fields: Record<string, string>; roofMaterials: Record<string, string>; nocStatuses: Record<string, string>; areaReasons: Record<string, string> }
): string {
  const template = copy.warnings[w.code] ?? copy.warnings.unknown
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(w.params ?? {})) {
    if (k === 'roof_material') vars[k] = copy.roofMaterials[String(v)] ?? String(v)
    else if (k === 'society_noc_status') vars[k] = copy.nocStatuses[String(v)] ?? String(v)
    else if (k === 'field') vars[k] = copy.fields[String(v)] ?? String(v)
    else if (k === 'reason') vars[k] = copy.areaReasons[String(v)] ?? String(v)
    else vars[k] = paramText(k, v, copy.limiting)
  }
  return fmt(template, vars)
}

/** kW for display: JSON numbers, up to 2 decimals, en-IN. */
export function formatKw(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)
}
