// FE-19 item 5: the FE-17 access gaps, closed with the BE-19 routes (access_control.md §§1, 5, 6):
// Admins named on the no-access page, last sign-in and two-step on Employees, alert addresses
// for staff managers, the requester's name, and a Network Manager's badge.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ACCESS_MATRIX } from './fixtures/access-matrix'
import { ALERTS, STAFF, approvalRequest } from './fixtures/access-contract'
import { fakeBackend } from './helpers/fake-backend'
import { decidableCount } from '@/lib/access/approvals'
import { adminNames } from '@/components/dashboard/NoAccess'

const h = vi.hoisted(() => ({ roles: ['admin'] as string[], id: 'user_admin2' }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
  useUser: () => ({ isLoaded: true, user: { id: h.id, publicMetadata: { roles: h.roles } } }),
}))
// vitest.setup.ts answers useAccessAdmins with "not loaded" for every other test; this file uses the real hook.
vi.mock('@/lib/access/api', async (orig) => await orig())

const { default: NoAccess } = await import('@/components/dashboard/NoAccess')
const { default: EmployeesPage } = await import('@/app/(internal)/dashboard/employees/page')
const { default: AlertRoutingPage } = await import('@/app/(internal)/dashboard/access/alerts/page')
const { default: ApprovalsPage } = await import('@/app/(internal)/dashboard/approvals/page')

const show = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

beforeEach(() => {
  h.roles = ['admin']
  h.id = 'user_admin2'
})
afterEach(() => vi.unstubAllGlobals())

describe('no-access page names the Admins (GET /access/admins)', () => {
  it('names them, sorted as the server sent them', async () => {
    h.roles = ['sales']
    fakeBackend({ 'GET /access/admins': { body: { items: [{ id: 'u1', name: 'Ada Admin', email: null }, { id: 'u2', name: 'Raju Paul', email: null }] } } })
    show(<NoAccess what="Payments" />)
    expect(await screen.findByTestId('admin-names')).toHaveTextContent('Ada Admin or Raju Paul')
  })

  it('shows the email only when the server gives it (an Admin viewer)', () => {
    expect(adminNames([{ id: 'u1', name: 'Ada', email: 'ada@gridnova.in' }])).toBe('Ada (ada@gridnova.in)')
    expect(adminNames([{ id: 'u1', name: 'A', email: null }, { id: 'u2', name: 'B', email: null }, { id: 'u3', name: 'C', email: null }])).toBe('A, B or C')
  })

  it('while the list is unknown it still says what to do', async () => {
    h.roles = ['sales']
    fakeBackend({ 'GET /access/admins': { status: 500, body: { detail: 'boom' } } })
    show(<NoAccess what="Payments" />)
    expect(screen.getByTestId('no-access')).toHaveTextContent('ask a Grid Nova Admin to change your roles')
    await waitFor(() => expect(screen.queryByTestId('admin-names')).toBeNull())
  })
})

describe('Employees: last sign-in and two-step (BE-19, read from Clerk)', () => {
  it('shows the time, "Not known" for null, and flags two-step off for a role that requires it', async () => {
    const staff = STAFF.map((e) =>
      e.id === 'user_admin2'
        ? { ...e, last_sign_in_at: '2026-10-27T04:30:00Z', two_factor_enabled: false }
        : e.id === 'user_raju'
          ? { ...e, last_sign_in_at: null, two_factor_enabled: null }
          : { ...e, last_sign_in_at: '2026-10-20T10:00:00Z', two_factor_enabled: true },
    )
    fakeBackend({
      'GET /access/matrix': { body: ACCESS_MATRIX },
      'GET /employees': { body: staff },
      'GET /staff/invitations': { body: { items: [] } },
      'GET /approvals?status=pending': { body: { items: [] } },
    })
    show(<EmployeesPage />)
    expect(await screen.findByTestId('last-sign-in-user_admin2')).toHaveTextContent('27 Oct 2026')
    expect(screen.getByTestId('last-sign-in-user_raju')).toHaveTextContent('Not known')
    expect(screen.getByTestId('two-step-user_raju')).toHaveTextContent('Not known')
    expect(screen.getByTestId('two-step-user_mita')).toHaveTextContent('On')
    const adminRequires = ACCESS_MATRIX.roles.find((r) => r.id === 'admin')!.requires_two_factor
    expect(screen.getByTestId('two-step-user_admin2')).toHaveTextContent(adminRequires ? 'Off — required for their role' : 'Off')
  })
})

describe('alert routing: the addresses, for staff managers only', () => {
  it('lists the addresses by role and the shared mailboxes when the server sends them', async () => {
    const withAddresses = {
      events: ALERTS.events.map((e, i) =>
        i === 0 ? { ...e, addresses: { fixed: ['info@gridnova.in'], by_role: { accounts: ['acc@gridnova.in', 'acc2@gridnova.in'] } } } : e,
      ),
    }
    fakeBackend({ 'GET /access/alerts': { body: withAddresses }, 'GET /access/matrix': { body: ACCESS_MATRIX } })
    show(<AlertRoutingPage />)
    const first = ALERTS.events[0].event
    const list = await screen.findByTestId(`addresses-${first}`)
    expect(list).toHaveTextContent('acc@gridnova.in, acc2@gridnova.in')
    expect(list).toHaveTextContent('Shared mailboxes: info@gridnova.in')
  })

  it('without `addresses` (everyone else) it shows counts only', async () => {
    fakeBackend({ 'GET /access/alerts': { body: ALERTS }, 'GET /access/matrix': { body: ACCESS_MATRIX } })
    show(<AlertRoutingPage />)
    await screen.findByTestId('alert-routing')
    expect(screen.queryByTestId(/^addresses-/)).toBeNull()
  })

  it('the two new alerts have names', async () => {
    const { alertEventLabel } = await import('@/lib/access/alerts-view')
    expect(alertEventLabel('proposal_ready_for_review')).toBe('Drafted proposal waits for approval')
    expect(alertEventLabel('studio_converted')).toBe('Studio proposal turned into a lead')
  })
})

describe('approvals: the requester’s name and the Network Manager’s badge', () => {
  it('shows requested_by_name without needing the staff list', async () => {
    h.roles = ['network_manager']
    h.id = 'user_nm'
    const req = approvalRequest({ approval_request_id: 'apr-9', requested_by: 'user_x', requested_by_name: 'Mita Sen', action: 'commissions.payout_batch_approve', payload: {} })
    fakeBackend({ 'GET /approvals?status=pending': { body: { items: [req] } } })
    show(<ApprovalsPage />)
    expect(await screen.findByTestId('approval-apr-9')).toHaveTextContent('Asked by Mita Sen')
  })

  it('the Network Manager’s badge counts only what it can decide, even if an old server still lists an Admin grant', () => {
    const nm = ACCESS_MATRIX.roles.find((r) => r.id === 'network_manager')!
    const adminGrant = approvalRequest({ approval_request_id: 'a', requested_by: 'x', action: 'staff.set_roles', payload: { roles: ['admin'], before: [] } })
    const theirs = approvalRequest({ approval_request_id: 'b', requested_by: 'x', action: 'commissions.payout_batch_approve', payload: {} })
    expect(decidableCount([adminGrant, theirs], 'user_nm', nm.can_assign_roles)).toBe(1)
  })
})
