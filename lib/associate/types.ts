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

// GET /api/v1/associate/territory/members — Preferred Associates only (403
// for a plain Associate). capability/level are both always present and
// exactly one is non-null: a plain Associate has capability, a Preferred
// Associate has level. customer_count is a bare number (no customer detail)
// and can include customers whose site is outside the caller's territory.
export interface TerritoryMember {
  associate_id: string
  full_name: string
  associate_type: ApplicationType
  capability: AssociateCapability | null
  level: AssociateLevel | null
  status: AssociateStatus
  customer_count: number
  verified_customer_count: number
}

export interface TerritoryMemberListParams {
  page?: number
  page_size?: number
  status?: AssociateStatus
  associate_type?: ApplicationType
}

export interface PaginatedTerritoryMembers {
  items: TerritoryMember[]
  page: number
  page_size: number
  total: number
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

// POST /dashboard/associates/{id}/status (associate_journeys.md §4): the associate as
// before, plus what happened to their Clerk access and how many customers they still own.
export interface AssociateAccessChange {
  clerk_banned?: boolean
  invitation_revoked?: boolean
  clerk_unbanned?: boolean
  clerk_error: string | null
}

export interface AssociateStatusChange extends AdminAssociate {
  /** null when nothing changed for Clerk. */
  access: AssociateAccessChange | null
  open_customers: number
}

// POST /dashboard/associates/{id}/reassign-customers.
export interface ReassignCustomersInput {
  to_associate_id: string
  reason: string
  /** Omitted: every open customer. */
  onboarding_ids?: number[]
}

// GET /dashboard/associates/{id}/customers (associate_journeys.md §10), oldest first.
export interface AssociateCustomer {
  onboarding_id: number
  client_code: string | null
  customer_name: string | null
  status: string
  project_stage: string | null
  // "Not closed" — the same test the move uses.
  open: boolean
}

export interface AssociateCustomers {
  associate_id: string
  open_customers: number
  items: AssociateCustomer[]
}

export interface ReassignCustomersResult {
  from_associate_id: string
  to_associate_id: string
  onboarding_ids: number[]
  moved: number
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
