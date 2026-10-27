// FE-17: the approvals inbox, "Who can do what" (GET /access/matrix) and alert routing
// (GET /access/alerts), against the real hooks and a faked backend.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ApprovalsPage from '@/app/(internal)/dashboard/approvals/page'
import WhoCanDoWhatPage from '@/app/(internal)/dashboard/access/page'
import AlertRoutingPage from '@/app/(internal)/dashboard/access/alerts/page'
import { decidable, decidableCount, myPending, waitingForLabel } from '@/lib/access/approvals'
import { groupMatrix } from '@/lib/access/matrix-view'
import { recipientsLine } from '@/lib/access/alerts-view'
import { ACCESS_MATRIX } from './fixtures/access-matrix'
import { ALERTS, STAFF, approvalRequest } from './fixtures/access-contract'
import { fakeBackend, refusal } from './helpers/fake-backend'

const h = vi.hoisted(() => ({ roles: ['admin'] as string[], id: 'user_admin2', toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
  useUser: () => ({ isLoaded: true, user: { id: h.id, publicMetadata: { roles: h.roles } } }),
}))

const show = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

beforeEach(() => {
  h.roles = ['admin']
  h.id = 'user_admin2'
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

const MINE = approvalRequest({ approval_request_id: 'apr-mine', requested_by: 'user_admin2', summary: 'Invite Nila Roy as admin', action: 'staff.invite' })
const THEIRS = approvalRequest({ approval_request_id: 'apr-1', requested_by: 'user_me' })

describe('approvals helpers', () => {
  it('the inbox is other people’s pending requests; mine wait', () => {
    expect(decidable([MINE, THEIRS, approvalRequest({ approval_request_id: 'x', status: 'approved' })], 'user_admin2').map((r) => r.approval_request_id)).toEqual(['apr-1'])
    expect(myPending([MINE, THEIRS], 'user_admin2').map((r) => r.approval_request_id)).toEqual(['apr-mine'])
    expect(decidableCount([MINE, THEIRS], undefined)).toBe(0)
    expect(waitingForLabel('staff.set_roles')).toBe('Waiting for a second Admin')
  })

  it('a staff request shows only to someone who may assign every role it touches (2nd pass: NM saw an Accounts invite it could not approve)', () => {
    const accountsInvite = approvalRequest({ approval_request_id: 'inv', action: 'staff.invite', payload: { roles: ['accounts'], switches: ['role.accounts'] } })
    const salesToAdmin = THEIRS // before: sales, roles: admin + sales
    const rate = approvalRequest({ approval_request_id: 'rate', action: 'commissions.standard_rate_publish', payload: {} })
    const nm = ['sales', 'engineer', 'operations']
    expect(decidable([accountsInvite, salesToAdmin, rate], 'user_nm', nm).map((r) => r.approval_request_id)).toEqual(['rate'])
    expect(decidable([accountsInvite, salesToAdmin], 'user_admin2', ACCESS_MATRIX.roles.map((r) => r.id)).map((r) => r.approval_request_id)).toEqual(['inv', 'apr-1'])
    expect(waitingForLabel('payouts.batch_approve')).toBe('Waiting for a second approver')
  })
})

describe('Approvals inbox', () => {
  it('lists what, who asked, when and expiry; my own request shows as waiting', async () => {
    fakeBackend({ 'GET /approvals?status=pending': { body: { items: [MINE, THEIRS] } }, 'GET /employees': { body: STAFF } })
    show(<ApprovalsPage />)
    const item = await screen.findByTestId('approval-apr-1')
    expect(item).toHaveTextContent('Role change')
    expect(item).toHaveTextContent('Change Raju Paul’s roles from sales to admin, sales')
    await waitFor(() => expect(item).toHaveTextContent('Asked by Tanmoy Halder'))
    expect(item).toHaveTextContent('Expires 29 Oct 2026')
    expect(screen.queryByTestId('approval-apr-mine')).not.toBeInTheDocument()
    expect(screen.getByTestId('waiting-approvals')).toHaveTextContent('Waiting for a second Admin')
    expect(screen.getByTestId('waiting-approvals')).toHaveTextContent('Invite Nila Roy as admin')
  })

  it('approves with an optional note', async () => {
    const api = fakeBackend({ 'GET /approvals?status=pending': { body: { items: [THEIRS] } }, 'GET /employees': { body: STAFF }, 'POST /approvals/apr-1/approve': { body: approvalRequest({ status: 'approved' }) } })
    const user = userEvent.setup()
    show(<ApprovalsPage />)
    await user.click(within(await screen.findByTestId('approval-apr-1')).getByRole('button', { name: 'Approve' }))
    await user.type(screen.getByLabelText(/Note/), 'Agreed in the Monday meeting')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(api.called('POST', '/approvals/apr-1/approve')[0]?.body).toEqual({ note: 'Agreed in the Monday meeting' }))
    expect(h.toast.success).toHaveBeenCalledWith('Approved — the change has been applied.')
  })

  it('rejects', async () => {
    const api = fakeBackend({ 'GET /approvals?status=pending': { body: { items: [THEIRS] } }, 'GET /employees': { body: STAFF }, 'POST /approvals/apr-1/reject': { body: approvalRequest({ status: 'rejected' }) } })
    const user = userEvent.setup()
    show(<ApprovalsPage />)
    await user.click(within(await screen.findByTestId('approval-apr-1')).getByRole('button', { name: 'Reject' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(api.called('POST', '/approvals/apr-1/reject')).toHaveLength(1))
  })

  it.each([
    ['self_approval', 403, 'You asked for this change, so someone else has to approve it.'],
    ['not_an_approver', 403, 'You can’t approve this request.'],
    ['approval_not_pending', 409, 'This request has already been decided.'],
    ['approval_expired', 409, 'This request has expired. Ask for the change again.'],
    ['approval_stale', 409, 'This person’s roles changed after the request was made. Ask for the change again.'],
    ['admin_floor', 409, 'Grid Nova must always have at least two Admins.'],
  ])('%s is a plain sentence', async (code, status, sentence) => {
    fakeBackend({ 'GET /approvals?status=pending': { body: { items: [THEIRS] } }, 'GET /employees': { body: STAFF }, 'POST /approvals/apr-1/approve': refusal(status, code) })
    const user = userEvent.setup()
    show(<ApprovalsPage />)
    await user.click(within(await screen.findByTestId('approval-apr-1')).getByRole('button', { name: 'Approve' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByTestId('decision-error')).toHaveTextContent(sentence)
  })

  it('an empty inbox says so', async () => {
    fakeBackend({ 'GET /approvals?status=pending': { body: { items: [] } }, 'GET /employees': { body: STAFF } })
    show(<ApprovalsPage />)
    expect(await screen.findByTestId('approvals-empty')).toBeInTheDocument()
  })

  it('is closed to people who decide nothing (no request made)', () => {
    h.roles = ['sales']
    const api = fakeBackend({})
    show(<ApprovalsPage />)
    expect(screen.getByTestId('no-access')).toBeInTheDocument()
    expect(api.calls).toEqual([])
  })
})

describe('Who can do what', () => {
  it('groups permissions by area and searches descriptions, ids and role names', () => {
    const all = groupMatrix(ACCESS_MATRIX)
    expect(all.map((g) => g.area)).toEqual(['Leads', 'Proposals and pricing', 'Customers, meetings and analytics', 'Associate network and surveys', 'Execution and service', 'Money', 'Company setup and oversight'])
    expect(all.reduce((n, g) => n + g.permissions.length, 0)).toBe(ACCESS_MATRIX.permissions.length)
    const bank = groupMatrix(ACCESS_MATRIX, 'bank file')
    expect(bank.flatMap((g) => g.permissions.map((p) => p.id))).toEqual(['payouts.bank_file.export'])
    expect(groupMatrix(ACCESS_MATRIX, '', 'operations').flatMap((g) => g.permissions.map((p) => p.id))).toEqual(ACCESS_MATRIX.roles.find((r) => r.id === 'operations')!.permissions)
  })

  it('renders the role × permission table read-only for anyone on staff', async () => {
    h.roles = ['operations']
    fakeBackend({ 'GET /access/matrix': { body: ACCESS_MATRIX } })
    const user = userEvent.setup()
    show(<WhoCanDoWhatPage />)
    const table = await screen.findByTestId('access-matrix')
    expect(within(table.querySelector('thead')!).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Permission', 'Admin', 'Management', 'Network Manager', 'Sales', 'Engineer', 'Operations', 'Accounts'])
    const bankRow = screen.getByTestId('perm-payouts.bank_file.export')
    expect(within(bankRow).getByLabelText('Accounts: yes')).toBeInTheDocument()
    expect(within(bankRow).getByLabelText('Admin: no')).toBeInTheDocument()
    expect(bankRow).toHaveTextContent('Two-step sign-in')
    expect(screen.getByTestId('role-card-network_manager')).toHaveTextContent('Gives: Sales, Engineer, Operations')
    expect(screen.queryByRole('button', { name: /save|edit/i })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Search permissions'), 'payout bank')
    expect(screen.getAllByTestId(/^perm-/).map((r) => r.dataset.testid)).toEqual(['perm-payouts.bank_file.export'])
    await user.clear(screen.getByLabelText('Search permissions'))
    await user.type(screen.getByLabelText('Search permissions'), 'zzz')
    expect(screen.getByTestId('matrix-no-match')).toBeInTheDocument()
  })
})

describe('Alert routing', () => {
  it('counts recipients in words, never addresses', () => {
    expect(recipientsLine(ALERTS.events[0], ACCESS_MATRIX)).toBe('1 Accounts · 1 shared mailbox')
    expect(recipientsLine(ALERTS.events[1], ACCESS_MATRIX)).toBe('2 Admin · the assigned person')
  })

  it('shows each alert, its roles, who gets it now, and warns when one reaches nobody', async () => {
    h.roles = ['engineer']
    fakeBackend({ 'GET /access/alerts': { body: ALERTS }, 'GET /access/matrix': { body: ACCESS_MATRIX } })
    show(<AlertRoutingPage />)
    const row = await screen.findByTestId('alert-new_lead')
    expect(row).toHaveTextContent('New lead')
    expect(row).toHaveTextContent('+ assigned person')
    await waitFor(() => expect(within(row).getByText('Management')).toBeInTheDocument())
    expect(screen.getByTestId('alert-associate_application_submitted')).toHaveTextContent('Nobody yet')
    expect(screen.getByTestId('silent-alerts')).toHaveTextContent('One alert reaches nobody right now: Associate application submitted')
  })
})
