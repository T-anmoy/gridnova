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

export interface OnboardingWarning {
  code: WarningCode
  message: string
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

export interface OnboardingFile {
  document_type?: string
  photo_slot?: string
  file_ref: string
  filename: string
  received_at: string
  latitude: number | null
  longitude: number | null
  client_captured_at: string | null
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

export interface OnboardingAttribution {
  locked_until: string | null
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
  // Associate-only.
  can_edit?: boolean
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
  attribution_lock_days: number
}

// ── POST "" (create) ─────────────────────────────────────────────────────

export interface CreateOnboardingInput {
  notice_version: string
  notice_acknowledged: true
  customer: OnboardingCustomer
  territory: { state_lgd_code: number; district_lgd_code?: number; block_lgd_code?: number }
  site_latitude?: number
  site_longitude?: number
  connection_in_customer_name: boolean
  property_in_customer_name: boolean
  customer_timeline: string
  equipment_package: string
  [key: string]: unknown
}

export interface CreateOnboardingResponse {
  onboarding: Onboarding
  warnings: OnboardingWarning[]
}

export interface OnboardingListParams {
  status?: OnboardingStatus
  mine_only?: boolean
  page?: number
  page_size?: number
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
}

// ── Progress ──────────────────────────────────────────────────────────────

export type ProgressStageKey =
  | 'registered'
  | 'verified'
  | 'site_assessed'
  | 'proposal_requested'
  | 'proposal_prepared'
  | 'proposal_issued'
  | 'accepted'
  | 'agreement_signed'
  | 'portal_agreement_approved'

export interface ProgressStage {
  stage: ProgressStageKey
  label: string
  recorded: boolean
  recorded_at: string | null
  recorded_by: string | null
  evidence: { via: string } | null
  note: string | null
}

export interface ProgressResponse {
  project_id: number
  current_stage: ProgressStageKey | null
  next_stage: ProgressStageKey | null
  stages: ProgressStage[]
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
}

export interface Estimate {
  estimate_id: number
  indicative: true
  created_at: string
  created_by: string
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
