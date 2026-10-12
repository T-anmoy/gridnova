// Types for the on-site site survey (S1), exactly as backend
// `docs/api/site_survey.md` §1–§6 states them. Enums not spelled out there come
// from the committed `docs/api/openapi.json` (the contract per BE-1 §6).
// Engineer review, corrections and the report (§8–§11) are deliberately absent:
// a later session builds them.

export type SurveyVariant = 'individual_house' | 'housing_society' | 'commercial_roof'
export const SURVEY_VARIANTS: readonly SurveyVariant[] = ['individual_house', 'housing_society', 'commercial_roof']

// Section keys come from the server (`options.survey.variants.*[].key`) and can grow.
export type SurveySectionKey = 'connection' | 'bills' | 'roof' | 'roof_area' | 'layout' | (string & {})

export type RoofMaterial = 'concrete_flat' | 'tin_shed' | 'asbestos' | 'other'
export type RoofOrientation = 'south' | 'east' | 'west' | 'north' | 'mixed' | 'unknown'
export type RoofObstacle = 'water_tank' | 'stair_room' | 'trees' | 'nearby_building' | 'overhead_line' | 'antenna_dish' | 'other'
export type InverterLocation = 'terrace' | 'indoor_wall' | 'outdoor_wall' | 'other'
export type DistanceMethod = 'tape' | 'laser' | 'estimated'
export type SocietyNocStatus = 'obtained' | 'in_progress' | 'not_required' | 'not_available'

// Existing site-assessment enums the checklist also uses (openapi.json).
export type ConnectionPhase = 'single_phase' | 'three_phase'
export type ShadingCondition = 'none' | 'partial_morning' | 'partial_evening' | 'heavy'
export const CONNECTION_PHASES: readonly ConnectionPhase[] = ['single_phase', 'three_phase']
export const SHADING_CONDITIONS: readonly ShadingCondition[] = ['none', 'partial_morning', 'partial_evening', 'heavy']

/** One bill month as the server stores and returns it: numbers, not strings (§1). */
export interface ConsumptionMonth {
  month: string
  units_kwh: number | null
  bill_inr?: number | null
}

/** A roof section as returned: metres as decimal strings ("10.00", §1). */
export interface RoofSection {
  label: string
  length_m: string
  width_m: string
  obstacle_area_sqm?: string | null
}

/** A roof section as sent. */
export interface RoofSectionInput {
  label: string
  length_m: number
  width_m: number
  obstacle_area_sqm?: number | null
}

// ── GET /options → survey (§2) ────────────────────────────────────────────

export interface SurveySectionDef {
  key: SurveySectionKey
  fields: string[]
}

export interface SurveyConditional {
  section: SurveySectionKey
  when: Record<string, unknown>
  require: string[]
}

export interface SurveyOptions {
  variants: Record<SurveyVariant, SurveySectionDef[]>
  conditional: SurveyConditional[]
  discom_options: string[]
  roof_materials: RoofMaterial[]
  roof_orientations: RoofOrientation[]
  roof_obstacles: RoofObstacle[]
  inverter_locations: InverterLocation[]
  distance_methods: DistanceMethod[]
  society_noc_statuses: SocietyNocStatus[]
  max_roof_sections: number
  requested_consumption_months: number
  min_consumption_months: number
  max_consumption_months: number
  distance_max_m: number
  signature_max_kb: number
  required_to_submit: boolean
  resign_after_edit: boolean
}

// ── GET /{id}/survey (§3) ─────────────────────────────────────────────────

export interface SurveySectionStatus {
  key: SurveySectionKey
  complete: boolean
  missing: string[]
  // `bills` only.
  months_recorded?: number
  months_required?: number
  months_requested?: number
}

export type SignatureParty = 'customer' | 'associate'

export interface SurveySignatureState {
  signed: boolean
  signed_at: string | null
}

export type SurveyReviewOutcome = 'feasible' | 'feasible_with_conditions' | 'revisit_needed' | 'not_feasible'

export interface SurveyStatus {
  onboarding_id: number
  variant: SurveyVariant
  sections: SurveySectionStatus[]
  complete: boolean
  signatures: Record<SignatureParty, SurveySignatureState>
  declaration: { name: string | null; declared_at: string | null }
  required_to_submit: boolean
  grandfathered: boolean
  // Filled by the Engineer review (§8) — read here only, no UI in this session.
  review?: {
    outcome: SurveyReviewOutcome | null
    notes: string | null
    conditions: string[]
    revisit_items: { section: string; field: string | null; note: string }[]
    reviewed_at: string | null
    revised_after_review: boolean
  }
  report?: { generated_at: string | null }
}

// ── GET /{id}/survey/results (§4) ─────────────────────────────────────────

export type LimitingFactor = 'area' | 'load' | 'usage'

export type SurveyWarningCode =
  | 'requested_above_suggested'
  | 'load_enhancement_needed'
  | 'implied_tariff_outside_range'
  | 'units_bill_mismatch'
  | 'three_phase_below_min'
  | 'fragile_roof'
  | 'overhead_line'
  | 'roof_not_owned_no_noc'
  | 'society_noc_missing'
  | 'area_implausible'
  | 'duplicate_consumer_number'

/** Code + params only — never English (§4). Unknown future codes are kept as strings. */
export interface SurveyWarning {
  code: SurveyWarningCode | (string & {})
  params?: Record<string, unknown>
}

export interface SurveyPackagePrice {
  basic: string
  gst: string
  final: string
  display_name: string
  net_after_subsidy?: string | null
}

export type SurveyPriceStatus = 'list_price' | 'custom_quote' | 'not_enough_to_size'

export interface SurveyEstimate {
  indicative: true
  size_kw: number | null
  price_status: SurveyPriceStatus
  custom_quote_reasons: string[]
  priced_kw?: number | null
  phase?: 'SINGLE' | 'THREE' | null
  packages: Record<string, SurveyPackagePrice>
  subsidy_inr?: string | null
  subsidy_conditions?: string[]
  price_list_version?: number | string | null
}

export interface SurveyResults {
  onboarding_id: number
  variant: SurveyVariant
  max_by_area_kw: number | null
  max_by_load_kw: number | null
  recommended_by_usage_kw: number | null
  suggested_kw: number | null
  limiting_factor: LimitingFactor | null
  requested_kw: number | null
  bills: {
    months_recorded: number
    average_monthly_units_kwh: number | null
    average_monthly_bill_inr: string | null
    implied_tariff_inr_per_kwh: string | null
  }
  assumptions: { area_sqft_per_kw: number; load_cap_ratio: number; target_offset_percent: number }
  warnings: SurveyWarning[]
  // Absent for Engineers (staff route) — never assume it.
  estimate?: SurveyEstimate
}

// ── POST /{id}/survey/signatures/{party} (§5) ─────────────────────────────

export interface SignSurveyInput {
  party: SignatureParty
  file: Blob
  declaration_name?: string
  customer_confirms_data?: boolean
}

// ── Structured 422s on create/PATCH (§1) ──────────────────────────────────

export type SurveyFieldErrorCode =
  | 'invalid_month'
  | 'future_month'
  | 'duplicate_month'
  | 'units_required'
  | 'too_many_months'
  | 'obstacle_exceeds_section'
  | 'derived_field'
  | 'out_of_range'
  | 'roofs_considered_exceeds_available'

export interface SurveyFieldError {
  code: SurveyFieldErrorCode | (string & {})
  field?: string
  index?: number
  message?: string
  max_months?: number
  max_m?: number
}

export type SignatureErrorCode =
  | 'file_too_large'
  | 'declaration_name_required'
  | 'confirmation_required'
  | 'signature_not_png'
  | 'not_editable'
  | 'storage_not_configured'
