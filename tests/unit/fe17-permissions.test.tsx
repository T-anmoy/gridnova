// FE-17: the one permissions source — the REAL usePermissions() against GET /employees/me.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { employeeMeFor } from './helpers/permissions-bridge'
import { fakeBackend, refusal } from './helpers/fake-backend'

vi.unmock('@/lib/access/use-permissions')

const h = vi.hoisted(() => ({ metadata: {} as Record<string, unknown> }))
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
  useUser: () => ({ isLoaded: true, user: { id: 'user_me', publicMetadata: h.metadata } }),
}))

let qc: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

async function load() {
  const { usePermissions } = await import('@/lib/access/use-permissions')
  return renderHook(() => usePermissions(), { wrapper })
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  h.metadata = {}
})
afterEach(() => vi.unstubAllGlobals())

describe('usePermissions()', () => {
  it('answers from GET /employees/me: can() for held permissions, roles, two-step status', async () => {
    fakeBackend({ 'GET /employees/me': { body: employeeMeFor(['admin', 'accounts'], { id: 'user_me', two_factor_ok: false }) } })
    const { result } = await load()
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.can('payouts.bank_file.export')).toBe(true)
    expect(result.current.can('staff.manage')).toBe(true)
    expect(result.current.can(['governance.manage', 'payouts.bank_file.export'])).toBe(true)
    expect(result.current.roles).toEqual(['admin', 'accounts'])
    expect(result.current.primaryRole).toBe('admin')
    expect(result.current.employeeId).toBe('user_me')
    expect(result.current.twoFactorOk).toBe(false)
    expect(result.current.requiresTwoFactor).toBe(true)
  })

  it('an Admin alone does not hold the payout bank file', async () => {
    fakeBackend({ 'GET /employees/me': { body: employeeMeFor(['admin']) } })
    const { result } = await load()
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.can('payouts.bank_file.export')).toBe(false)
    expect(result.current.can('governance.manage')).toBe(true)
  })

  it('Clerk’s roles are only a first-paint hint: shown as roles, never as permissions', async () => {
    h.metadata = { roles: ['admin'], role: 'admin' }
    let answer: ((v: Response) => void) | null = null
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { answer = r })))
    const { result } = await load()
    expect(result.current.isLoaded).toBe(false)
    expect(result.current.roles).toEqual(['admin'])
    expect(result.current.can('staff.manage')).toBe(false)
    expect(result.current.can('any_staff')).toBe(false)
    // The server says this person is Sales now: the server wins.
    await waitFor(() => expect(answer).not.toBeNull())
    await act(async () => answer!(new Response(JSON.stringify(employeeMeFor(['sales'])), { status: 200 })))
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.roles).toEqual(['sales'])
    expect(result.current.can('staff.manage')).toBe(false)
    expect(result.current.can('leads.create')).toBe(true)
  })

  it('the older single `role` in Clerk metadata still gives a hint', async () => {
    h.metadata = { role: 'engineer' }
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { result } = await load()
    expect(result.current.roles).toEqual(['engineer'])
  })

  it('refetches when the window regains focus — a role change applies without signing out', async () => {
    const api = fakeBackend({ 'GET /employees/me': { body: employeeMeFor(['sales']) } })
    const { result } = await load()
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.can('staff.manage')).toBe(false)
    api.on('GET /employees/me', { body: employeeMeFor(['network_manager']) })
    // Past the stale window, a focus event triggers the refetch.
    qc.getQueryCache().find({ queryKey: ['employee-me'] })!.setState({ dataUpdatedAt: 0 })
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true) })
    await waitFor(() => expect(result.current.can('staff.manage')).toBe(true))
    expect(api.called('GET', '/employees/me').length).toBe(2)
  })

  it('refetches after any role change made in this browser', async () => {
    const api = fakeBackend({
      'GET /employees/me': { body: employeeMeFor(['admin']) },
      'PUT /employees/user_me/roles': { body: { employee_id: 'user_me', roles: ['admin', 'accounts'], role: 'admin', previous_roles: ['admin'], clerk_synced: true } },
    })
    const { usePermissions } = await import('@/lib/access/use-permissions')
    const { useSetEmployeeRoles } = await import('@/lib/access/api')
    const { result } = renderHook(() => ({ p: usePermissions(), set: useSetEmployeeRoles() }), { wrapper })
    await waitFor(() => expect(result.current.p.isLoaded).toBe(true))
    api.on('GET /employees/me', { body: employeeMeFor(['admin', 'accounts']) })
    await act(async () => { await result.current.set.mutateAsync({ employeeId: 'user_me', roles: ['admin', 'accounts'] }) })
    await waitFor(() => expect(result.current.p.can('payouts.bank_file.export')).toBe(true))
  })

  it.each([
    [refusal(403, 'not_invited'), 'not_invited'],
    [refusal(403, 'invitation_expired'), 'invitation_expired'],
    [{ status: 403, body: { detail: 'This account has been deactivated.' } }, 'deactivated'],
  ])('a refusal is kept as the error and allows nothing (%s)', async (reply, kind) => {
    fakeBackend({ 'GET /employees/me': reply })
    const { signInBlockOf } = await import('@/lib/access/errors')
    const { result } = await load()
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(signInBlockOf(result.current.error)).toBe(kind)
    expect(result.current.can('any_staff')).toBe(false)
  })
})
