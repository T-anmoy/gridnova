// Types mirroring the Phase 3B onboarding API contract, exactly as pasted
// into this session (no field invented beyond it). Kept separate from
// ./types.ts (Phase 2A associate-network) because this is a distinct domain
// with its own object graph (onboarding/estimate/proposal/progress).

export type OnboardingStatus = 'draft' | 'submitted' | 'verified' | 'closed'

export type WarningCode =
  | 'non_dcr_pm_surya_ghar'
  | 'kw_exceeds_sanctioned_load'
  | 'kw_high_for_consumption'
  | 'pin_district_mismatch'
  | 'pin_not_in_directory'
  | 'attribution_review'
  | SiteLocationWarningCode

export interface OnboardingWarning {
  code: WarningCode
  message: string
  // Present on site-location warnings: `site_location.warning.<code>`.
  message_key?: string
}

// ── Site location (Phase 3C) ─────────────────────────────────────────────

export type SiteLocationSource =
  | 'device_gps'
  | 'photo_gps'
  | 'google_maps_link'
  | 'pasted_coordinates'
  | 'staff_entered'
  | 'unknown_legacy'

export type SiteLocationFlag =
  | 'low_accuracy'
  | 'accuracy_unknown'
  | 'approximate_location'
  | 'unverified_source'
  | 'far_from_photos'
  | 'location_missing'

export type SiteLocationWarningCode =
  | 'low_accuracy'
  | 'accuracy_unknown'
  | 'approximate_location'
  | 'unverified_source'
  | 'far_from_photos'
  | 'accuracy_poor'

export const SITE_LOCATION_WARNING_CODES: readonly string[] = [
  'low_accuracy',
  'accuracy_unknown',
  'approximate_location',
  'unverified_source',
  'far_from_photos',
  'accuracy_poor',
]

// The owner and staff get every field; a Preferred Associate viewing a
// downline customer gets only `present` and `confirmed` — so every other
// field is optional and must never be assumed.
export interface SiteLocation {
  present: boolean
  confirmed: boolean
  latitude?: number | null
  longitude?: number | null
  source?: SiteLocationSource | null
  accuracy_m?: number | null
  captured_at?: string | null
  verified?: boolean
  confirmed_at?: string | null
  confirmed_by?: string | null
  precision?: 'exact' | 'viewport_center' | null
  flags?: SiteLocationFlag[]
  photo_distance_m?: number | null
  maps_url?: string | null
  // Staff only.
  check_with_customer?: boolean
}

export type SetSiteLocationInput =
  | { source: 'device_gps'; latitude: number; longitude: number; accuracy_m: number; captured_at: string }
  | { source: 'photo_gps'; photo_slot: string }
  | { source: 'google_maps_link'; link: string }
  | { source: 'pasted_coordinates'; text: string }

export interface SiteLocationOptions {
  accuracy_good_m: number
  accuracy_warn_m: number
  accuracy_reject_m: number
  sample_seconds: number
  required_to_submit: boolean
  sources: SiteLocationSource[]
  recommended_source: SiteLocationSource
}

export interface SiteLocationResponse extends Onboarding {
  warnings: OnboardingWarning[]
}

export interface CorrectSiteLocationInput {
  source: 'google_maps_link' | 'pasted_coordinates'
  link?: string
  text?: string
  reason: string
}

export interface TerritoryRef {
  lgd_code: number
  name: string
}

export interface OnboardingTerritory {
  state: TerritoryRef
  district: TerritoryRef | null
  block: TerritoryRef | null
}

export interface OnboardingOwner {
  associate_id: string
  full_name: string
  associate_type: 'associate' | 'preferred_associate'
}

export interface OnboardingCustomer {
  name: string
  mobile: string
  email: string | null
}

// How a photo reached the server. `null` on photos uploaded before provenance existed.
export type CaptureMethod = 'camera' | 'gallery'

// Staff-only fraud-style flags; associates never see these (see PhotoFlagBadges).
export type PhotoFlag = 'gallery_upload' | 'no_metadata' | 'old_photo' | 'duplicate_photo'

export interface OnboardingFile {
  document_type?: string
  photo_slot?: string
  file_ref: string
  filename: string
  received_at: string
  latitude: number | null
  longitude: number | null
  // Photos only. `null` to a Preferred Associate viewing a downline customer.
  accuracy_m?: number | null
  client_captured_at: string | null
  // Photos only.
  capture_method?: CaptureMethod | null
  location_verified?: boolean
  flags?: PhotoFlag[]
}

export interface OnboardingChecklist {
  required: string[]
  present: string[]
  missing: string[]
}

export interface OnboardingNotice {
  version: string
  acknowledged_at: string
  recorded_by: string
}

export interface OnboardingVerification {
  completed: boolean
  verified_at: string | null
  // Staff-only fields — absent on the associate-facing object.
  note?: string
  verified_by_employee_id?: string
}

// BE-11 (attribution_lock.md): a verified onboarding stays locked until the
// project is completed, the lead is lost, or an Admin closes it. Before
// verification `locked` is false with a null reason.
export interface OnboardingAttribution {
  locked: boolean
  released_reason: 'project_completed' | 'lead_lost' | 'closed' | null
  under_review: boolean
  // Staff-only.
  open_flags?: number
}

export interface ScoreFactor {
  code: string
  label: string
  weight: number
  earned_fraction: number
}

export interface OnboardingScore {
  score: number
  band: 'hot' | 'warm' | 'cold'
  factors: ScoreFactor[]
  scored_at: string
  response_due_at: string | null
  escalation_level: number | null
}

// The two states this session must never render the same way — see
// migration 0035's final shape, pasted into this conversation.
export interface FormalProposalBlocked {
  reason: 'missing_information' | 'draft_failed'
  missing_fields: string[]
  missing: string[]
  draft_error: string | null
  draft_failed_at: string | null
  requested_at: string | null
  requested_by: string | null
}

export interface OnboardingSiteAssessment {
  proposal_inputs_id: number
  status: string
  [key: string]: unknown
}

export interface EstimatedCommission {
  amount: string | null
  rate: string | null
  basis: 'accepted_proposal' | 'indicative_estimate'
  value_used: string
  basis_amount: string | null
  pending_reason: 'placeholder_rates' | 'basis_unavailable' | null
  // BE-12: which rate the estimate used; null when there is no rate yet.
  rate_source?: 'standard' | 'individual' | null
}

export interface Onboarding {
  onboarding_id: number
  status: OnboardingStatus
  lead_id: number
  project_reference_id: string | null
  owner: OnboardingOwner
  customer: OnboardingCustomer
  territory: OnboardingTerritory
  site_latitude: number | null
  site_longitude: number | null
  site_location: SiteLocation
  connection_in_customer_name: boolean
  property_in_customer_name: boolean
  customer_timeline: string | null
  site_assessment: OnboardingSiteAssessment | null
  documents: OnboardingFile[]
  photos: OnboardingFile[]
  checklist: OnboardingChecklist
  notice: OnboardingNotice
  verification: OnboardingVerification
  attribution: OnboardingAttribution
  score: OnboardingScore | null
  formal_proposal_blocked: FormalProposalBlocked | null
  submitted_at: string | null
  warnings: OnboardingWarning[]
  created_at: string
  updated_at: string
  // On list responses (associate and staff).
  progress_summary?: ProgressSummary
  // Associate-only.
  can_edit?: boolean
  // BE-10 (associate_ease.md §2), associate list + detail. An estimate only —
  // null for a closed record, a territory (non-owner) viewer, or no basis yet.
  estimated_commission?: EstimatedCommission | null
  // Staff-only.
  closed_reason?: string | null
}

// ── GET /options ──────────────────────────────────────────────────────────

export interface EquipmentPackageOption {
  key: string
  label: string
  equipment_tier: string
}

export interface DocumentOption {
  key: string
  label: string
  required_when: string | null
}

export interface PhotoSlotOption {
  key: string
  label: string
  example_image_url?: string | null
}

export interface OnboardingOptions {
  notice: { version: string; text: string }
  equipment_packages: EquipmentPackageOption[]
  documents: DocumentOption[]
  photo_slots: PhotoSlotOption[]
  customer_timelines: string[]
  site_location: SiteLocationOptions
  // S1 site survey (site_survey.md §2).
  survey: import('./survey-types').SurveyOptions
}

// ── POST "" (create) and PATCH ────────────────────────────────────────────
// Both bodies are FLAT (openapi.json `OnboardingCreate` / `OnboardingUpdate`):
// `customer_name`, `state_lgd_code`… — never nested `customer` / `territory`
// objects (the server ignores unknown keys, so a nested body is silently lost).

export type CustomerType = 'individual' | 'organisation'
export type SiteType = 'rooftop_residential' | 'rooftop_commercial' | 'rooftop_institutional' | 'ground_mounted' | 'carport' | 'other'
export type ConnectionType = 'on_grid' | 'off_grid' | 'hybrid'
export type CustomerTimeline = 'within_1_month' | 'within_3_months' | 'within_6_months' | 'later' | 'unsure'
export const CUSTOMER_TYPES: readonly CustomerType[] = ['individual', 'organisation']
export const SITE_TYPES: readonly SiteType[] = ['rooftop_residential', 'rooftop_commercial', 'rooftop_institutional', 'ground_mounted', 'carport', 'other']
export const CONNECTION_TYPES: readonly ConnectionType[] = ['on_grid', 'off_grid', 'hybrid']

export interface CreateOnboardingInput {
  notice_version: string
  notice_acknowledged: true
  customer_name: string
  customer_mobile: string
  customer_email?: string | null
  customer_type: CustomerType
  // The portal is the rooftop checklist: always `rooftop_solar` (decided 12 Oct).
  project_family: 'rooftop_solar'
  pin_code: string
  full_address: string
  site_type: SiteType
  connection_type: ConnectionType
  state_lgd_code: number
  district_lgd_code: number
  block_lgd_code?: number
  connection_in_customer_name: boolean
  property_in_customer_name: boolean
  customer_timeline?: string
  equipment_package?: string
  // Any site-assessment / survey field (site_survey.md §1) may ride along.
  [key: string]: unknown
}

/** Create returns the onboarding object itself, with `warnings` beside its fields. */
export type CreateOnboardingResponse = Onboarding & { warnings: OnboardingWarning[] }

export interface OnboardingListParams {
  status?: OnboardingStatus
  mine_only?: boolean
  page?: number
  page_size?: number
}

// A compact, server-computed status for each customer on a list page, so cards
// never need a per-customer progress request.
export interface ProgressSummary {
  current_stage: ProgressStageKey | null
  stage_label: string | null
  next_stage: ProgressStageKey | null
  next_stage_label: string | null
  needs_action: boolean
  action_kinds: string[]
  // 'formal_proposal_blocked' | 'payment_gate' | 'dcr_mismatch' today.
  blocked: { reason: string } | null
}

export interface PaginatedOnboardings {
  items: Onboarding[]
  page: number
  page_size: number
  total: number
}

// ── Files ─────────────────────────────────────────────────────────────────

export interface UploadFileInput {
  file: File
  kind: 'document' | 'photo'
  document_type?: string
  photo_slot?: string
  latitude?: number
  longitude?: number
  captured_at?: string
  // Photo provenance. The server infers `camera` from a GPS pair when omitted.
  capture_method?: CaptureMethod
  accuracy_m?: number
  exif_taken_at_client?: string
  onProgress?: (percent: number) => void
}

export interface FileLinkResponse {
  url: string
  expires_at: string
  filename: string
  file_ref: string
}

// ── Submit ────────────────────────────────────────────────────────────────

export interface SubmitIncompleteDetail {
  code: 'incomplete'
  message: string
  missing_documents: string[]
  // Both are always present on `incomplete`.
  missing_site_location: boolean
  site_location_unconfirmed: boolean
  // S1 (site_survey.md §6): always present; both empty when the survey is not required.
  missing_survey_sections: string[]
  survey_unsigned: ('customer' | 'associate')[]
}

// ── Progress ──────────────────────────────────────────────────────────────

// Stage keys come from the backend and can grow (new execution stages). The
// UI never assumes this is a closed set — see lib/onboarding/progress.ts for the
// keys it knows how to group, and its fallback for the rest.
export type ProgressStageKey = string

export interface ProgressStage {
  stage: ProgressStageKey
  label: string
  recorded: boolean
  recorded_at: string | null
  recorded_by: string | null
  // `via` is e.g. 'associate_submission' | 'direct' | 'admin_override'.
  evidence: { via: string } | null
  note: string | null
}

export interface ProgressAging {
  days_in_stage: number
  stuck_threshold_days: number | null
  is_stuck: boolean
}

export type ExecutionMode = 'associate' | 'grid_nova'

export interface ProgressResponse {
  project_id: number
  current_stage: ProgressStageKey | null
  next_stage: ProgressStageKey | null
  // Ordered by the backend; stages that don't apply to the project are absent
  // here and listed in `not_applicable` instead.
  stages: ProgressStage[]
  not_applicable?: { stage: ProgressStageKey; label: string }[]
  execution_mode?: ExecutionMode | null
  execution_started_at?: string | null
  aging?: ProgressAging | null
}

// ── Estimates ─────────────────────────────────────────────────────────────

export type SizingMethod = 'requested_size' | 'by_units' | 'by_bill' | 'by_roof_area'
export type AccessDifficulty = 'easy' | 'moderate' | 'difficult'

export interface CreateEstimateInput {
  segment?: string
  roof_type?: string
  access_difficulty?: AccessDifficulty
  is_housing_society?: boolean
}

export interface EstimateResult {
  recommended_size_kw: number
  sizing_detail?: string
  base_cost: number
  adders: number
  component_breakdown: unknown
  subtotal_before_tax: number
  gst_amount: number
  subsidy_inr: number
  net_cost: number
  is_indicative_range: boolean
  net_cost_range_min: number | null
  net_cost_range_max: number | null
  note?: string | null
  // PM-A price-list fields. Absent on estimates made before the price list existed,
  // whose stored result is returned unchanged (and shown the old way).
  price_status?: 'list_price' | 'custom_quote'
  custom_quote_reasons?: string[]
  recommended_kw_exact?: number | string | null
  priced_kw?: number | string | null
  priced_kw_differs?: boolean
  phase?: 'SINGLE' | 'THREE' | null
  packages?: Record<string, import('@/lib/pricing/price-list').PackagePrice>
  gst_rule?: import('@/lib/pricing/price-list').GstRule | null
  price_list_version?: string | null
  destination?: string | null
  subsidy_conditions?: string[]
  chosen_packages?: string[] | null
  // BE-14: the stored result carries every solar-estimate field
  // (lib/pricing/solar-estimate.ts) — read only through parseSolarEstimate.
  estimate_version?: string | null
  [key: string]: unknown
}

export interface Estimate {
  estimate_id: number
  indicative: true
  created_at: string
  created_by: string
  // List/GET items repeat these at the top level (null before the price list).
  price_status?: 'list_price' | 'custom_quote' | null
  price_list_version?: string | null
  priced_kw?: number | string | null
  chosen_packages?: string[] | null
  inputs: {
    segment?: string
    state?: string
    sizing_method: SizingMethod
    [key: string]: unknown
  }
  result: EstimateResult
}

export interface EstimateListResponse {
  items: Estimate[]
}

// ── Formal proposal (request + read) ─────────────────────────────────────

export interface RequestFormalProposalResponse {
  request: { ready: boolean; missing_fields: string[] }
  progress: ProgressResponse
}

export type FormalProposalReadResponse =
  | { prepared: false; missing_fields: string[] }
  | {
      prepared: true
      proposal_id: number
      version: number
      status: string
      total_value: number | null
      approved_at: string | null
      date_sent: string | null
      accepted_at: string | null
      ready_to_hand_over: boolean
      pdf: { url: string; expires_at: string } | null
    }

// ── In-person acceptance ─────────────────────────────────────────────────

export interface InPersonAcceptanceInput {
  proposal_id: number
  delivered_on: string
  note: string
  reference: string
}

export interface InPersonAcceptanceResponse {
  formal_proposal: FormalProposalReadResponse
  progress: ProgressResponse
}

// ── Agreement ─────────────────────────────────────────────────────────────

export interface AgreementLinks {
  agreement_pdf?: { url: string; expires_at: string } | null
  signed_scan?: { url: string; expires_at: string } | null
}

export interface AgreementResponse {
  [key: string]: unknown
  links: AgreementLinks
}

export interface UploadSignedAgreementInput {
  file: File
  stamp_paper_number: string
  stamp_paper_date: string
}
