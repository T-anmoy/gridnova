// Staff-side (dashboard) onboarding types. The onboarding object itself is
// the same wire shape associates get, just with the staff-only fields
// (verification.note/verified_by_employee_id, attribution.open_flags,
// closed_reason) populated — reuse that single source of truth rather than
// redeclaring the whole graph.
import type {
  AgreementResponse,
  Estimate,
  InPersonAcceptanceInput,
  InPersonAcceptanceResponse,
  Onboarding,
  OnboardingStatus,
  ProgressResponse,
  UploadSignedAgreementInput,
} from '@/lib/associate/onboarding-types'

export type { Onboarding, InPersonAcceptanceInput, InPersonAcceptanceResponse, AgreementResponse, UploadSignedAgreementInput }

export interface StaffOnboardingListParams {
  status?: OnboardingStatus
  flagged?: boolean
  needs_attention?: boolean
  page?: number
  page_size?: number
}

export interface PaginatedOnboardings {
  items: Onboarding[]
  page: number
  page_size: number
  total: number
}

export interface VerificationCallInput {
  verification_call_completed: true
  note: string
}

export interface EstimateListResponse {
  items: Estimate[]
}

// ── Attribution flags ────────────────────────────────────────────────────

export type AttributionFlagStatus = 'open' | 'resolved'

export interface AttributionFlagOnboardingRef {
  onboarding_id: number
  owner: { associate_id: string; full_name: string; associate_type: string }
  customer: { name: string; mobile: string; email: string | null }
  created_at: string
  status: OnboardingStatus
}

export interface AttributionFlag {
  flag_id: number
  status: AttributionFlagStatus
  onboardings: [AttributionFlagOnboardingRef, AttributionFlagOnboardingRef]
  created_at: string
  resolved_at: string | null
  resolution: 'keep_existing' | 'award_new' | null
  resolution_note: string | null
}

export interface AttributionFlagListParams {
  status?: AttributionFlagStatus
}

export interface ResolveAttributionFlagInput {
  resolution: 'keep_existing' | 'award_new'
  note: string
}

// ── Formal proposal (staff prepare) ──────────────────────────────────────

export interface PrepareFormalProposalInput {
  customer_email?: string
}

export interface PrepareFormalProposalResponse {
  formal_proposal: {
    proposal_id: number
    version: number
    status: string
    requires_manager_signoff: boolean
    onboarding_id: number
  }
  progress: ProgressResponse
}

export interface PortalAgreementApprovedInput {
  note: string
  reference?: string
}
