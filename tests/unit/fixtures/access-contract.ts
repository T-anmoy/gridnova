// BE-17 response bodies, written from the examples in docs/api/access_control.md (the
// openapi snapshot leaves these responses untyped). Used by the FE-17 screen and hook tests.
import type { Employee } from '@/lib/dashboard/types'
import type { AccessAlerts, ApprovalRequest, DeactivateResponse, HandoverResponse, PendingApproval, StaffInvitation } from '@/lib/access/types'

export const INVITATION: StaffInvitation = {
  invitation_id: '9f1c-inv',
  name: 'Abhijit Bhattacharjee',
  email: 'abhijit@gridnova.in',
  roles: ['network_manager'],
  status: 'pending',
  invited_by: 'user_2ab',
  clerk_status: 'sent',
  created_at: '2026-10-20T06:30:00Z',
  expires_at: '2026-10-27T06:30:00Z',
  resent_at: null,
  accepted_employee_id: null,
  accepted_at: null,
  revoked_by: null,
  revoked_at: null,
}

export const invitation = (over: Partial<StaffInvitation> = {}): StaffInvitation => ({ ...INVITATION, ...over })

export const APPROVAL_REQUEST: ApprovalRequest = {
  approval_request_id: 'apr-1',
  action: 'staff.set_roles',
  summary: 'Change Raju Paul’s roles from sales to admin, sales',
  payload: { employee_id: 'user_raju', roles: ['admin', 'sales'], before: ['sales'], switches: ['role.admin'] },
  status: 'pending',
  requested_by: 'user_2ab',
  created_at: '2026-10-26T10:00:00Z',
  expires_at: '2026-10-29T10:00:00Z',
  decided_by: null,
  decided_at: null,
  decision_note: null,
  result: null,
}

export const approvalRequest = (over: Partial<ApprovalRequest> = {}): ApprovalRequest => ({ ...APPROVAL_REQUEST, ...over })

export const pendingApproval = (request: ApprovalRequest = APPROVAL_REQUEST): PendingApproval => ({
  status: 'pending_approval',
  message: 'Waiting for a second approver. Eligible approvers have been emailed.',
  approval_request: request,
})

export const HANDOVER: HandoverResponse = {
  employee_id: 'user_raju',
  open_leads: [{ lead_id: 12, pipeline_stage: 'qualified' }, { lead_id: 14, pipeline_stage: 'new' }],
  open_proposals: [{ proposal_id: 4, lead_id: 12, status: 'draft' }],
  pending_invitations: [{ invitation_id: 'inv-x', email: 'x@gridnova.in' }],
}

export const deactivated = (over: Partial<DeactivateResponse> = {}): DeactivateResponse => ({
  employee_id: 'user_raju',
  is_active: false,
  clerk_banned: true,
  sessions_revoked: true,
  clerk_error: null,
  handover: { open_leads: HANDOVER.open_leads, open_proposals: HANDOVER.open_proposals, pending_invitations: HANDOVER.pending_invitations },
  ...over,
})

const employee = (over: Partial<Employee>): Employee => ({
  id: 'user_x',
  name: 'Someone',
  email: 'someone@gridnova.in',
  role: 'sales',
  roles: ['sales'],
  regions: [],
  is_active: true,
  created_at: '2026-01-05T00:00:00Z',
  google_calendar_connected: false,
  ...over,
})

/** The signed-in Admin is `user_me`. */
export const STAFF: Employee[] = [
  employee({ id: 'user_me', name: 'Tanmoy Halder', email: 'tanmoy@gridnova.in', role: 'admin', roles: ['admin', 'accounts'] }),
  employee({ id: 'user_admin2', name: 'Priya Das', email: 'priya@gridnova.in', role: 'admin', roles: ['admin'] }),
  employee({ id: 'user_raju', name: 'Raju Paul', email: 'raju@gridnova.in', role: 'sales', roles: ['sales'] }),
  employee({ id: 'user_mita', name: 'Mita Sen', email: 'mita@gridnova.in', role: 'sales', roles: ['sales'], google_calendar_connected: true }),
  employee({ id: 'user_eng', name: 'Arup Ghosh', email: 'arup@gridnova.in', role: 'engineer', roles: ['engineer'] }),
  employee({ id: 'user_old', name: 'Meera Iyer', email: 'meera@gridnova.in', role: 'operations', roles: ['operations'], is_active: false }),
]

export const ALERTS: AccessAlerts = {
  events: [
    { event: 'payment_recorded', roles: ['accounts'], assigned_employee: false, active_holders: { accounts: 1 }, fixed_addresses: 1, reaches_someone: true },
    { event: 'new_lead', roles: ['admin', 'management'], assigned_employee: true, active_holders: { admin: 2, management: 0 }, fixed_addresses: 0, reaches_someone: true },
    { event: 'associate_application_submitted', roles: ['network_manager', 'admin'], assigned_employee: false, active_holders: { network_manager: 0, admin: 0 }, fixed_addresses: 0, reaches_someone: false },
  ],
}
