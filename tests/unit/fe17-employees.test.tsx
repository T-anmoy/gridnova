// FE-17 Employees page against the real BE-17 hooks and a faked backend: invite, resend,
// revoke, role change (with second approval), deactivate with handover and reassignment,
// reactivate, inviter scope, and every refusal as a plain sentence.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EmployeesPage from '@/app/(internal)/dashboard/employees/page'
import { ACCESS_MATRIX } from './fixtures/access-matrix'
import { HANDOVER, STAFF, approvalRequest, deactivated, invitation, pendingApproval } from './fixtures/access-contract'
import { fakeBackend, refusal } from './helpers/fake-backend'

const h = vi.hoisted(() => ({ roles: ['admin', 'accounts'] as string[], toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
  useUser: () => ({ isLoaded: true, user: { id: 'user_me', publicMetadata: { roles: h.roles } } }),
}))

function baseRoutes() {
  return {
    'GET /access/matrix': { body: ACCESS_MATRIX },
    'GET /employees': { body: STAFF },
    'GET /staff/invitations': { body: { items: [invitation(), invitation({ invitation_id: 'inv-old', name: 'Old Invite', email: 'old@gridnova.in', roles: ['sales'], status: 'expired' }), invitation({ invitation_id: 'inv-done', status: 'accepted' })] } },
    'GET /approvals?status=pending': { body: { items: [] } },
    'GET /employees/user_raju/handover': { body: HANDOVER },
  } as Record<string, Parameters<typeof fakeBackend>[0][string]>
}

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><EmployeesPage /></QueryClientProvider>)
}

const row = (name: string) => screen.getByText(name).closest('tr')!

beforeEach(() => {
  h.roles = ['admin', 'accounts']
  vi.clearAllMocks()
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('Employees page — who sees it', () => {
  it('is the calm no-access state for someone without staff.manage, and asks the server nothing', () => {
    h.roles = ['sales']
    const api = fakeBackend(baseRoutes())
    show()
    expect(screen.getByTestId('no-access')).toHaveTextContent('You don’t have access to this — ask an Admin')
    expect(api.calls).toEqual([])
  })

  it('lists active staff with role chips, pending invitations with expiry, and turned-off people with Reactivate', async () => {
    fakeBackend(baseRoutes())
    show()
    expect(await screen.findByText('Raju Paul')).toBeInTheDocument()
    expect(within(row('Tanmoy Halder')).getByText('Admin')).toBeInTheDocument()
    expect(within(row('Tanmoy Halder')).getByText('Accounts')).toBeInTheDocument()
    expect(within(row('Tanmoy Halder')).getByText('(you)')).toBeInTheDocument()
    // Pending and lapsed invitations; an accepted one is not listed.
    const inv = await screen.findByTestId('invitation-9f1c-inv')
    expect(inv).toHaveTextContent('Network Manager')
    expect(inv).toHaveTextContent('Expires 27 Oct 2026')
    expect(screen.getByTestId('invitation-inv-old')).toHaveTextContent('Expired')
    expect(screen.queryByTestId('invitation-inv-done')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('inactive-user_old')).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    expect(screen.getByText('5 active · 1 turned off')).toBeInTheDocument()
  })

  it('never offers to deactivate yourself', async () => {
    fakeBackend(baseRoutes())
    show()
    await screen.findByText('Raju Paul')
    expect(within(row('Tanmoy Halder')).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(within(row('Raju Paul')).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
  })
})

describe('Invite staff', () => {
  async function openInvite(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByTestId('invite-staff'))
    await screen.findByTestId('role-picker')
  }

  it('offers an Admin every role with its label and description, and marks Admin and Accounts as needing a second Admin', async () => {
    fakeBackend(baseRoutes())
    const user = userEvent.setup()
    show()
    await openInvite(user)
    for (const r of ACCESS_MATRIX.roles) expect(screen.getByTestId(`role-option-${r.id}`)).toBeInTheDocument()
    const admin = screen.getByTestId('role-option-admin').closest('label')!
    expect(admin).toHaveTextContent(ACCESS_MATRIX.roles.find((r) => r.id === 'admin')!.description)
    expect(admin).toHaveTextContent('Needs a second Admin’s approval')
    expect(screen.getByTestId('role-option-sales').closest('label')).not.toHaveTextContent('Needs a second Admin’s approval')
  })

  it('inviter scope: a Network Manager is offered only Sales, Engineer and Operations', async () => {
    h.roles = ['network_manager']
    fakeBackend(baseRoutes())
    const user = userEvent.setup()
    show()
    await openInvite(user)
    const offered = ACCESS_MATRIX.roles.filter((r) => screen.queryByTestId(`role-option-${r.id}`)).map((r) => r.id)
    expect(offered).toEqual(['sales', 'engineer', 'operations'])
  })

  it('ticking Engineer after Sales unticks Sales (one of the exclusive roles per person)', async () => {
    fakeBackend(baseRoutes())
    const user = userEvent.setup()
    show()
    await openInvite(user)
    await user.click(screen.getByTestId('role-option-sales'))
    await user.click(screen.getByTestId('role-option-accounts'))
    await user.click(screen.getByTestId('role-option-engineer'))
    expect(screen.getByTestId('role-option-sales')).not.toBeChecked()
    expect(screen.getByTestId('role-option-engineer')).toBeChecked()
    expect(screen.getByTestId('role-option-accounts')).toBeChecked()
  })

  it('checks the form before sending anything', async () => {
    const api = fakeBackend(baseRoutes())
    const user = userEvent.setup()
    show()
    await openInvite(user)
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(screen.getByText('Enter the person’s full name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Pick at least one role.')).toBeInTheDocument()
    expect(api.called('POST', '/staff/invitations')).toEqual([])
  })

  it('sends name, email and roles and says where it went and when it expires', async () => {
    const api = fakeBackend({ ...baseRoutes(), 'POST /staff/invitations': { status: 201, body: invitation({ name: 'Nila Roy', email: 'nila@gridnova.in', roles: ['sales'], expires_at: '2026-11-03T06:30:00Z' }) } })
    const user = userEvent.setup()
    show()
    await openInvite(user)
    await user.type(screen.getByLabelText('Full name'), 'Nila Roy')
    await user.type(screen.getByLabelText('Work email'), 'nila@gridnova.in')
    await user.click(screen.getByTestId('role-option-sales'))
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByTestId('invite-sent')).toHaveTextContent('Invitation sent to nila@gridnova.in, expires on 03 Nov 2026.')
    expect(api.called('POST', '/staff/invitations')[0].body).toEqual({ name: 'Nila Roy', email: 'nila@gridnova.in', roles: ['sales'] })
  })

  it('an Admin invitation answers 202: nothing is sent until a second Admin approves', async () => {
    const req = approvalRequest({ action: 'staff.invite', summary: 'Invite Nila Roy (nila@gridnova.in) as admin' })
    fakeBackend({ ...baseRoutes(), 'POST /staff/invitations': { status: 202, body: pendingApproval(req) } })
    const user = userEvent.setup()
    show()
    await openInvite(user)
    await user.type(screen.getByLabelText('Full name'), 'Nila Roy')
    await user.type(screen.getByLabelText('Work email'), 'nila@gridnova.in')
    await user.click(screen.getByTestId('role-option-admin'))
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    const waiting = await screen.findByTestId('invite-waiting')
    expect(waiting).toHaveTextContent('Waiting for a second Admin')
    expect(waiting).toHaveTextContent('Invite Nila Roy (nila@gridnova.in) as admin')
  })

  it.each([
    [refusal(409, 'invitation_exists'), 'This email address already has a pending invitation. Resend that one instead.'],
    [refusal(409, 'already_staff'), 'This person is already on the staff list.'],
    [refusal(403, 'role_not_assignable', { roles: ['admin', 'accounts'] }), 'You can’t give Admin, Accounts. Ask an Admin to do it.'],
    [refusal(502, 'clerk_invitation_failed'), 'The invitation email could not be sent. Nothing was saved — try again.'],
  ])('a refusal is one plain sentence (%#)', async (reply, sentence) => {
    fakeBackend({ ...baseRoutes(), 'POST /staff/invitations': reply })
    const user = userEvent.setup()
    show()
    await openInvite(user)
    await user.type(screen.getByLabelText('Full name'), 'Nila Roy')
    await user.type(screen.getByLabelText('Work email'), 'nila@gridnova.in')
    await user.click(screen.getByTestId('role-option-sales'))
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByTestId('invite-error')).toHaveTextContent(sentence)
  })
})

describe('Pending invitations — resend and revoke', () => {
  it('resends and reports the new expiry', async () => {
    const api = fakeBackend({ ...baseRoutes(), 'POST /staff/invitations/9f1c-inv/resend': { body: invitation({ expires_at: '2026-11-05T06:30:00Z' }) } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('invitation-9f1c-inv')).getByRole('button', { name: 'Resend' }))
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Invitation sent again to abhijit@gridnova.in, expires on 05 Nov 2026.'))
    expect(api.called('POST', '/staff/invitations/9f1c-inv/resend')).toHaveLength(1)
  })

  it('revokes only after confirming', async () => {
    const api = fakeBackend({ ...baseRoutes(), 'DELETE /staff/invitations/9f1c-inv': { body: { ...invitation({ status: 'revoked' }), clerk_error: null } } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('invitation-9f1c-inv')).getByRole('button', { name: 'Revoke' }))
    expect(api.called('DELETE', '/staff/invitations/9f1c-inv')).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Withdraw invitation' }))
    await waitFor(() => expect(api.called('DELETE', '/staff/invitations/9f1c-inv')).toHaveLength(1))
    expect(h.toast.success).toHaveBeenCalledWith('Invitation to abhijit@gridnova.in withdrawn.')
  })

  it('a Network Manager cannot resend or revoke an invitation outside their scope', async () => {
    h.roles = ['network_manager']
    fakeBackend(baseRoutes())
    show()
    const nm = await screen.findByTestId('invitation-9f1c-inv')
    expect(within(nm).queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument()
    expect(within(screen.getByTestId('invitation-inv-old')).getByRole('button', { name: 'Resend' })).toBeInTheDocument()
  })
})

describe('Change roles', () => {
  it('sends the complete new set with PUT /employees/{id}/roles', async () => {
    const api = fakeBackend({ ...baseRoutes(), 'PUT /employees/user_raju/roles': { body: { employee_id: 'user_raju', roles: ['management', 'sales'], role: 'management', previous_roles: ['sales'], clerk_synced: true } } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_raju')).getByRole('button', { name: 'Change roles' }))
    await user.click(await screen.findByTestId('role-option-management'))
    expect(screen.queryByTestId('needs-second-approval')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save roles' }))
    await waitFor(() => expect(api.called('PUT', '/employees/user_raju/roles')[0]?.body).toEqual({ roles: ['management', 'sales'] }))
    expect(h.toast.success).toHaveBeenCalledWith('Raju Paul now holds Management, Sales.')
  })

  it('giving Admin says a second Admin must approve, and the 202 says so too', async () => {
    fakeBackend({ ...baseRoutes(), 'PUT /employees/user_raju/roles': { status: 202, body: pendingApproval() } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_raju')).getByRole('button', { name: 'Change roles' }))
    await user.click(await screen.findByTestId('role-option-admin'))
    expect(screen.getByTestId('needs-second-approval')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask for approval' }))
    await waitFor(() => expect(h.toast.message).toHaveBeenCalledWith('Waiting for a second Admin', { description: 'Change Raju Paul’s roles from sales to admin, sales' }))
  })

  it.each([
    ['admin_floor', 'Grid Nova must always have at least two Admins.'],
    ['own_admin_role', 'You can’t remove your own Admin role. Ask another Admin to do it.'],
    ['role_combination_not_supported', 'A person can hold only one of Sales, Engineer and Operations.'],
    ['clerk_sync_failed', 'The sign-in service could not be updated, so nothing was changed. Try again.'],
  ])('%s is a plain sentence', async (code, sentence) => {
    fakeBackend({ ...baseRoutes(), 'PUT /employees/user_admin2/roles': refusal(409, code) })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_admin2')).getByRole('button', { name: 'Change roles' }))
    await user.click(await screen.findByTestId('role-option-management'))
    await user.click(screen.getByRole('button', { name: /Save roles|Ask for approval/ }))
    expect(await screen.findByTestId('roles-error')).toHaveTextContent(sentence)
  })

  it('a Network Manager sees no actions on people with roles they cannot assign', async () => {
    h.roles = ['network_manager']
    fakeBackend(baseRoutes())
    show()
    await screen.findByText('Raju Paul')
    expect(within(row('Priya Das')).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('out-of-scope-user_admin2')).toHaveTextContent('No changes')
    expect(within(row('Raju Paul')).getByRole('button', { name: 'Change roles' })).toBeInTheDocument()
  })
})

describe('Deactivate with handover', () => {
  it('shows the handover list, moves the leads to the person picked, and reports both', async () => {
    const api = fakeBackend({
      ...baseRoutes(),
      'PATCH /employees/user_raju/deactivate': { body: deactivated() },
      'POST /employees/user_raju/reassign': { body: { from_employee_id: 'user_raju', to_employee_id: 'user_mita', lead_ids: [12, 14], moved: 2 } },
    })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_raju')).getByRole('button', { name: 'Deactivate' }))
    const list = await screen.findByTestId('handover-list')
    expect(list).toHaveTextContent('2 open leads')
    expect(list).toHaveTextContent('1 unfinished proposal')
    expect(list).toHaveTextContent('1 pending invitation they sent')
    expect(api.called('PATCH', '/employees/user_raju/deactivate')).toEqual([])
    await user.click(screen.getByTestId('lead-taker'))
    // Only active people who can take leads are offered — never the leaver, never an Engineer.
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options.some((o) => o?.startsWith('Mita Sen'))).toBe(true)
    expect(options.some((o) => o?.startsWith('Raju Paul') || o?.startsWith('Arup Ghosh'))).toBe(false)
    await user.click(screen.getByRole('option', { name: /Mita Sen/ }))
    await user.click(screen.getByTestId('confirm-deactivate'))
    expect(await screen.findByTestId('deactivate-done')).toHaveTextContent('Raju Paul’s access is turned off')
    expect(screen.getByTestId('leads-moved')).toHaveTextContent('2 leads moved to Mita Sen.')
    expect(api.called('POST', '/employees/user_raju/reassign')[0].body).toEqual({ to_employee_id: 'user_mita' })
    const order = api.calls.filter((c) => c.method !== 'GET').map((c) => c.path)
    expect(order).toEqual(['/employees/user_raju/deactivate', '/employees/user_raju/reassign'])
  })

  it('says so when the sign-in service did not confirm', async () => {
    fakeBackend({ ...baseRoutes(), 'PATCH /employees/user_raju/deactivate': { body: deactivated({ sessions_revoked: 1, clerk_error: 'Clerk session revoke failed for 1 of 2 session(s)' }) } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_raju')).getByRole('button', { name: 'Deactivate' }))
    await screen.findByTestId('handover-list')
    await user.click(screen.getByTestId('confirm-deactivate'))
    expect(await screen.findByTestId('clerk-not-confirmed')).toHaveTextContent('1 of 2 session(s)')
  })

  // BE-21: Clerk's free plan has no ban — every open session is ended instead, and that is
  // a success, never the "didn't confirm" warning.
  it.each([
    [deactivated({ sessions_revoked: 2 }), 'and all 2 open sessions have been ended.'],
    [deactivated({ sessions_revoked: 1 }), 'and their open session has been ended.'],
    [deactivated({ sessions_revoked: 0 }), 'they had no open sessions.'],
    [deactivated({ clerk_mode: 'ban', clerk_banned: true, sessions_revoked: null }), 'their sign-in is blocked and every open session has ended.'],
  ])('reports what Clerk did without a warning (%#)', async (body, sentence) => {
    fakeBackend({ ...baseRoutes(), 'PATCH /employees/user_raju/deactivate': { body } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_raju')).getByRole('button', { name: 'Deactivate' }))
    await screen.findByTestId('handover-list')
    await user.click(screen.getByTestId('confirm-deactivate'))
    expect(await screen.findByTestId('deactivate-done')).toHaveTextContent(sentence)
    expect(screen.queryByTestId('clerk-not-confirmed')).not.toBeInTheDocument()
  })

  it('a Network Manager (no leads.assign) is told an Admin or Management will move the leads', async () => {
    h.roles = ['network_manager']
    fakeBackend(baseRoutes())
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_raju')).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByTestId('reassign-not-allowed')).toBeInTheDocument()
    expect(screen.queryByTestId('lead-taker')).not.toBeInTheDocument()
  })

  it.each([
    ['admin_floor', 'Grid Nova must always have at least two Admins.'],
    ['self_deactivation', 'You can’t turn off your own access.'],
  ])('%s is a plain sentence', async (code, sentence) => {
    fakeBackend({ ...baseRoutes(), 'PATCH /employees/user_raju/deactivate': refusal(409, code) })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('staff-user_raju')).getByRole('button', { name: 'Deactivate' }))
    await screen.findByTestId('handover-list')
    await user.click(screen.getByTestId('confirm-deactivate'))
    expect(await screen.findByTestId('deactivate-error')).toHaveTextContent(sentence)
  })
})

describe('Reactivate', () => {
  it('turns access back on with the same roles', async () => {
    const api = fakeBackend({ ...baseRoutes(), 'PATCH /employees/user_old/reactivate': { body: { employee_id: 'user_old', is_active: true, roles: ['operations'], clerk_unbanned: true, clerk_error: null, clerk_mode: 'ban' } } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('inactive-user_old')).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(api.called('PATCH', '/employees/user_old/reactivate')).toHaveLength(1))
    expect(h.toast.success).toHaveBeenCalledWith('Meera Iyer’s access is back on, with the same roles as before.')
  })

  it('with sessions revoked (no ban to undo) it is still a plain success', async () => {
    fakeBackend({ ...baseRoutes(), 'PATCH /employees/user_old/reactivate': { body: { employee_id: 'user_old', is_active: true, roles: ['operations'], clerk_unbanned: false, clerk_error: null, clerk_mode: 'revoke_sessions' } } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('inactive-user_old')).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Meera Iyer’s access is back on, with the same roles as before.'))
  })

  it('a failed unban (ban mode) is reported', async () => {
    fakeBackend({ ...baseRoutes(), 'PATCH /employees/user_old/reactivate': { body: { employee_id: 'user_old', is_active: true, roles: ['operations'], clerk_unbanned: false, clerk_error: 'Clerk unban failed (HTTP 500)', clerk_mode: 'ban' } } })
    const user = userEvent.setup()
    show()
    await user.click(within(await screen.findByTestId('inactive-user_old')).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith(expect.stringContaining('didn’t confirm the unban (Clerk unban failed (HTTP 500))')))
  })
})

describe('Waiting for a second Admin', () => {
  it('lists my own pending staff requests with Withdraw', async () => {
    const api = fakeBackend({
      ...baseRoutes(),
      'GET /approvals?status=pending': { body: { items: [approvalRequest({ requested_by: 'user_me' })] } },
      'POST /approvals/apr-1/cancel': { body: approvalRequest({ status: 'cancelled' }) },
    })
    const user = userEvent.setup()
    show()
    const waiting = await screen.findByTestId('waiting-approvals')
    expect(waiting).toHaveTextContent('Waiting for a second Admin')
    expect(waiting).toHaveTextContent('Change Raju Paul’s roles from sales to admin, sales')
    await user.click(within(waiting).getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(api.called('POST', '/approvals/apr-1/cancel')).toHaveLength(1))
  })
})
