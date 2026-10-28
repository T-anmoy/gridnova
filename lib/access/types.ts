import type { Role } from '@/lib/dashboard/types'

// BE-17 response shapes (docs/api/access_control.md). openapi.json leaves these
// responses untyped, so the shapes come from the markdown contract.

// GET /access/matrix (§2)
export interface AccessPermission {
  id: string
  description: string
  sensitive: boolean
}

export interface AccessRole {
  id: Role
  label: string
  description: string
  requires_two_factor: boolean
  can_assign_roles: Role[]
  permissions: string[]
}

export interface AccessMatrix {
  permissions: AccessPermission[]
  roles: AccessRole[]
  exclusive_roles: Role[]
}

// GET /access/alerts (§6)
export interface AlertRoute {
  event: string
  roles: Role[]
  assigned_employee: boolean
  /** BE-18: the Studio proposal's owner receives it (and no shared mailbox does). */
  owner?: boolean
  active_holders: Partial<Record<Role, number>>
  fixed_addresses: number
  reaches_someone: boolean
}

export interface AccessAlerts {
  events: AlertRoute[]
}

// Staff invitations (§3)
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface StaffInvitation {
  invitation_id: string
  name: string
  email: string
  roles: Role[]
  status: InvitationStatus
  invited_by: string
  clerk_status: 'sent' | 'skipped'
  created_at: string
  expires_at: string
  resent_at: string | null
  accepted_employee_id: string | null
  accepted_at: string | null
  revoked_by: string | null
  revoked_at: string | null
  /** DELETE only: null, or why Clerk's revoke failed (the invitation is still refused). */
  clerk_error?: string | null
}

export interface InvitationIn {
  name: string
  email: string
  roles: Role[]
}

// Second approval (§5)
export type ApprovalAction =
  | 'staff.set_roles'
  | 'staff.invite'
  | 'commissions.standard_rate_publish'
  | 'commissions.individual_rate_change'
  | 'payouts.batch_approve'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

export interface ApprovalRequest {
  approval_request_id: string
  action: ApprovalAction | string
  summary: string
  payload: Record<string, unknown>
  status: ApprovalStatus
  requested_by: string
  created_at: string
  expires_at: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  result: unknown
}

/** The 202 answer of every route that waits for a second approver. */
export interface PendingApproval {
  status: 'pending_approval'
  message: string
  approval_request: ApprovalRequest
}

export function isPendingApproval(v: unknown): v is PendingApproval {
  return !!v && typeof v === 'object' && (v as { status?: unknown }).status === 'pending_approval'
}

// Roles, deactivation, handover (§4)
export interface RolesUpdated {
  employee_id: string
  roles: Role[]
  role: Role
  previous_roles: Role[]
  clerk_synced: boolean
  unchanged?: boolean
}

export interface Handover {
  open_leads: { lead_id: number; pipeline_stage: string }[]
  open_proposals: { proposal_id: number; lead_id: number; status: string }[]
  pending_invitations: { invitation_id: string; email: string }[]
}

export interface HandoverResponse extends Handover {
  employee_id: string
}

export interface DeactivateResponse {
  employee_id: string
  is_active: false
  clerk_banned: boolean
  sessions_revoked: boolean
  clerk_error: string | null
  handover: Handover
  approval_requests_withdrawn?: string[]
}

export interface ReactivateResponse {
  employee_id: string
  is_active: true
  roles: Role[]
  clerk_unbanned: boolean
  clerk_error: string | null
}

export interface ReassignResponse {
  from_employee_id: string
  to_employee_id: string
  lead_ids: number[]
  moved: number
}
