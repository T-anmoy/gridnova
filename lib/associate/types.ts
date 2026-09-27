// Types mirroring the Phase 2A API contract (associate network). Kept
// separate from lib/dashboard/types.ts because this domain has its own auth
// model (Clerk associate/preferred principal, not staff) and its own public,
// unauthenticated surface.

export type ApplicationType = 'associate' | 'preferred_associate'
export type ApplicationStatus = 'submitted' | 'under_review' | 'needs_info' | 'rejected' | 'approved'
export type AssociateCapability = 'sales' | 'execution'
export type AssociateLevel = 'state_head' | 'district_head' | 'block'
export type AssociateStatus = 'active' | 'suspended' | 'deactivated'

// ── Public reference data ────────────────────────────────────────────────────

export interface TerritoryState {
  lgd_code: number
  iso_code: string
  name: string
}

export interface TerritoryDistrict {
  lgd_code: number
  name: string
  has_blocks: boolean
}

export interface TerritoryBlock {
  lgd_code: number
  name: string
}

export interface KycConsent {
  version: string
  text: string
}

export interface SeatAvailability {
  level: AssociateLevel
  capacity: 2 | 1 | null
  held: number
  available: boolean
}

export interface ApplyResponse {
  application_id: number
  application_type: ApplicationType
  status: 'submitted'
  submitted_at: string
}

export interface FieldError {
  loc: (string | number)[]
  msg: string
  type: string
}

export interface BusinessErrorDetail {
  code: string
  message: string
  field?: string
}

export interface VerifyAssociateResponse {
  name: string
  photo_url: string | null
  type: ApplicationType
  level: AssociateLevel | null
  status: 'active' | 'inactive'
}

// ── Associate portal ─────────────────────────────────────────────────────────

export interface AssociateMe {
  associate_id: string
  associate_type: ApplicationType
  status: AssociateStatus
  full_name: string
  email: string
  mobile: string
  capability: AssociateCapability | null
  level: AssociateLevel | null
  territory: string | null
  approved_at: string | null
  documents: { id_card: boolean; welcome_letter: boolean }
}

export interface SignedDocumentLink {
  url: string
  expires_at: string
  filename: string
  document: string
}

// ── Admin: applications ──────────────────────────────────────────────────────

export interface TerritoryRef {
  lgd_code: number
  name: string
}

export interface ApplicationTerritory {
  state: TerritoryRef
  district: TerritoryRef | null
  block: TerritoryRef | null
}

export interface ApplicationListItem {
  application_id: number
  application_type: ApplicationType
  status: ApplicationStatus
  full_name: string
  mobile: string
  email: string
  submitted_at: string
  status_changed_at: string
  address_territory: ApplicationTerritory
  associate_id: string | null
  capability?: AssociateCapability
  requested_level?: AssociateLevel
  requested_territory?: ApplicationTerritory
}

export interface ApplicationDocument {
  document: string
  filename: string
  content_type: string
  size: number
}

export interface ApplicationReference {
  name: string
  mobile: string
}

export interface ApplicationDetail extends ApplicationListItem {
  date_of_birth: string
  address_line: string
  pin_code: string
  aadhaar_last4: string
  pan: string
  bank_account_last4: string
  bank_ifsc: string
  kyc_consent_version: string
  kyc_consent_accepted_at: string
  documents: ApplicationDocument[]
  needs_info_note: string | null
  rejection_reason: string | null
  verification_call_completed: boolean
  verification_call_note: string | null
  decided_at: string | null
  decided_by_employee_id: string | null
  business_type?: string
  gstin?: string | null
  office_address?: string
  prior_experience?: string
  team_size?: number
  references?: ApplicationReference[]
}

export interface ApplicationListParams {
  application_type?: ApplicationType
  status?: ApplicationStatus
  page?: number
  page_size?: number
}

// ── Admin: associates ─────────────────────────────────────────────────────────

export interface AssociateSeatRef {
  seat_id: number
  seat_no: number
  claimed_at: string
}

export interface AssociateDocumentsStatus {
  id_card: boolean
  welcome_letter: boolean
  generated_at: string | null
  error: string | null
}

export interface AdminAssociate {
  associate_id: string
  associate_type: ApplicationType
  status: AssociateStatus
  status_reason: string | null
  status_changed_at: string
  full_name: string
  email: string
  mobile: string
  capability: AssociateCapability | null
  level: AssociateLevel | null
  territory: string | null
  approved_at: string
  approved_by_employee_id: string
  clerk_user_bound: boolean
  seat: AssociateSeatRef | null
  application: { application_type: ApplicationType; application_id: number }
  clerk_invite_status: 'sent' | 'skipped' | 'failed' | null
  documents: AssociateDocumentsStatus
}

export interface AssociateListParams {
  status?: AssociateStatus
  associate_type?: ApplicationType
  page?: number
  page_size?: number
}

// ── Admin: territories and seats ─────────────────────────────────────────────

export interface AdminTerritoryItem {
  lgd_code: number
  name: string
  is_active: boolean
  iso_code?: string
  state_lgd_code?: number
  district_lgd_code?: number
}

export interface TerritorySeatHolder {
  associate_id: string
  full_name: string
  status: AssociateStatus
}

export interface TerritorySeat {
  seat_id: number
  level: AssociateLevel
  seat_no: number
  territory: string
  holder: TerritorySeatHolder | null
  claimed_at: string | null
  released_at: string | null
  released_by: string | null
  release_reason: string | null
}
