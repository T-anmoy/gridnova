// Verified request/response shapes for backend endpoints that Prompt 03
// originally had to guess (no contract was available for them at the time).
// The guesses were checked against the real backend source in Prompt 03b —
// most were wrong, and the wrongness was invisible because the unit test
// mocks encoded the same guesses. Every test exercising these endpoints
// should import its request/response shape from here rather than hand-roll
// one inline, so a future guess can't slip back in unnoticed.
//
// If the real backend ever changes one of these, update it here once and
// every dependent test fails loudly in the right place.

import type {
  AdjustPricingResponse,
  AssignableEmployee,
  ProposalDraftOutcome,
  ReviewProposalInputResponse,
} from '@/lib/dashboard/types'

// PATCH /proposals/{id}/adjust-pricing
// Who: admin and sales only (can_adjust_pricing) — never management.
export const ADJUST_PRICING_REQUEST_BODY = (newValue: number, reason: string) => ({
  new_value: newValue,
  reason,
})

export const ADJUST_PRICING_RESPONSE: AdjustPricingResponse = {
  status: 'pricing_adjusted',
  proposal_id: 501,
  total_value: 300000,
  requires_manager_signoff: true,
  reason: 'Equipment cost increased',
}

export const ADJUST_PRICING_FORBIDDEN_ROLE_MESSAGE = 'Your role cannot adjust proposal pricing.'
export const ADJUST_PRICING_FORBIDDEN_ASSIGNMENT_MESSAGE = 'This proposal is not assigned to you.'

// PATCH /proposal-inputs/{id}/review
// Who: admin and sales only (can_manage_proposal_inputs).
// IMPORTANT: the reject reason field is `rejection_reason` — a field named
// `reason` is silently ignored by the real backend.
export const REVIEW_PROPOSAL_INPUT_REJECT_BODY = (rejectionReason: string) => ({
  status: 'rejected' as const,
  internal_notes: undefined,
  rejection_reason: rejectionReason,
})

export const REVIEW_PROPOSAL_INPUT_APPROVE_BODY = () => ({
  status: 'approved_for_proposal' as const,
  internal_notes: undefined,
  rejection_reason: undefined,
})

export const PROPOSAL_DRAFT_TRIGGERED: ProposalDraftOutcome = {
  triggered: true,
  proposal_id: 501,
  version: 1,
}

export const PROPOSAL_DRAFT_NOT_TRIGGERED: ProposalDraftOutcome = {
  triggered: false,
  reason: 'Lead is missing required fields',
  missing_fields: ['capacity_kw'],
}

// The full response is the serialized site assessment (same shape as
// GET /proposal-inputs/{id}), plus `proposal_draft` only when approved —
// there are no top-level draft_proposal_id/missing_fields/draft_error
// fields.
export function reviewProposalInputResponse(
  overrides: Partial<ReviewProposalInputResponse> = {}
): ReviewProposalInputResponse {
  return {
    id: 7,
    lead_id: 19,
    status: 'approved_for_proposal',
    customer_type: 'individual',
    project_family: 'rooftop_solar',
    state: 'West Bengal',
    district: 'Hooghly',
    created_at: '2026-09-10T00:00:00Z',
    scheme_linked: false,
    scheme_name: null,
    pin_code: '712235',
    site_type: 'rooftop_residential',
    connection_type: 'on_grid',
    net_metering_required: true,
    dcr_panels_required: false,
    ev_charging: false,
    battery_storage: false,
    files: [],
    lead_fields_filled: {},
    ...overrides,
  }
}

// GET /proposals/{id} and GET /proposals — accept_url (Prompt 02c) is the
// real full website accept link; accept_path is the backend's own API path
// and must never be rendered or linked.
export const ACCEPT_URL_FIXTURE = 'https://www.gridnova.in/proposal/accept/tok_abc123'
export const ACCEPT_PATH_FIXTURE = '/api/v1/proposals/accept/tok_abc123'

// GET /employees/assignable — admin + management, not admin-only like
// GET /employees.
export const ASSIGNABLE_EMPLOYEES_FIXTURE: AssignableEmployee[] = [
  { id: 'emp-sales-1', name: 'Ravi Sharma', role: 'sales' },
  { id: 'emp-admin-1', name: 'Priya Nair', role: 'admin' },
]

// GET /leads?assigned=me|unassigned|any — no longer Sales-only. Admin and
// management get it too (they assign new website/chat leads); engineers and
// subcontractors don't list leads that way.
export const ASSIGNMENT_FILTER_ROLES = ['admin', 'management', 'sales'] as const
