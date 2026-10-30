// FE-17 §7–§8: what a refused person sees (not invited, invitation expired, deactivated,
// two-step required) and the two invitation sign-up pages.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/lib/dashboard/api-error'
import { parseApiError } from '@/lib/api/http'
import { ACCESS_ERROR_MESSAGES, accessErrorMessage, signInBlockOf } from '@/lib/access/errors'
import { clerkErrorCode, invitationEntry, isAlreadyRegistered, signInWithTicket } from '@/lib/auth/invitation'
import { permissionsValue } from './helpers/permissions-bridge'

const h = vi.hoisted(() => ({
  perms: null as unknown,
  user: { twoFactorEnabled: false, primaryEmailAddress: { emailAddress: 'stranger@example.com' } } as Record<string, unknown>,
  openUserProfile: vi.fn(),
  signOut: vi.fn(),
  getToken: vi.fn(async () => 'tok'),
  auth: { isLoaded: true, isSignedIn: false },
  signUp: { status: 'missing_requirements' as string, ticket: vi.fn(), finalize: vi.fn() },
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`) }),
}))
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ isLoaded: true, user: h.user }),
  useClerk: () => ({ openUserProfile: h.openUserProfile, signOut: h.signOut }),
  useAuth: () => ({ ...h.auth, getToken: h.getToken }),
  useSignUp: () => ({ signUp: h.signUp }),
  SignUp: (p: { path: string; forceRedirectUrl: string }) => <div data-testid="clerk-sign-up" data-path={p.path} data-after={p.forceRedirectUrl} />,
}))
vi.mock('next/navigation', async () => ({ ...(await import('./helpers/mock-navigation')).navigationMock, redirect: h.redirect }))
vi.mock('@/lib/access/use-permissions', () => ({ usePermissions: () => h.perms }))

const wrap = (ui: React.ReactElement) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
const refused = (status: number, detail: unknown) => parseApiError(status, 'x', JSON.stringify({ detail }))

beforeEach(() => {
  vi.clearAllMocks()
  h.perms = permissionsValue(['admin'])
  h.user = { twoFactorEnabled: false, primaryEmailAddress: { emailAddress: 'stranger@example.com' } }
  h.auth = { isLoaded: true, isSignedIn: false }
  h.signUp.status = 'missing_requirements'
  h.signUp.ticket.mockResolvedValue({ error: null })
  h.signUp.finalize.mockResolvedValue({ error: null })
})

describe('every BE-17 error code has a plain sentence', () => {
  const CODES = ['not_invited', 'invitation_expired', 'email_in_use', 'identity_check_unavailable', 'role_not_assignable', 'already_staff', 'invitation_exists', 'invalid_email', 'invalid_name', 'role_combination_not_supported', 'clerk_invitation_failed', 'invitation_not_pending', 'own_admin_role', 'admin_floor', 'employee_not_found', 'clerk_sync_failed', 'self_deactivation', 'not_assignable', 'same_employee', 'unknown_region', 'self_approval', 'not_an_approver', 'approval_not_pending', 'approval_expired', 'approval_stale', 'not_requester', 'two_factor_required']
  it.each(CODES)('%s', (code) => {
    const msg = accessErrorMessage(refused(409, { code, message: 'server words' }))
    expect(msg).toBe(ACCESS_ERROR_MESSAGES[code])
    expect(msg).not.toContain('server words')
    expect(msg).not.toMatch(/_/)
  })
  it('the two-Admin floor reads as the brief asks', () => {
    expect(ACCESS_ERROR_MESSAGES.admin_floor).toBe('Grid Nova must always have at least two Admins.')
  })
  it('an older plain-string 403 keeps the server’s words', () => {
    expect(accessErrorMessage(refused(403, 'Your role cannot decide approval requests.'))).toBe('Your role cannot decide approval requests.')
  })
  it('sign-in refusals are told apart from other errors', () => {
    expect(signInBlockOf(refused(403, { code: 'not_invited', message: 'x' }))).toBe('not_invited')
    expect(signInBlockOf(refused(403, 'This account has been deactivated.'))).toBe('deactivated')
    expect(signInBlockOf(refused(503, { code: 'identity_check_unavailable', message: 'x' }))).toBe('identity_check_unavailable')
    expect(signInBlockOf(refused(403, 'Your role cannot view the audit log.'))).toBeNull()
    expect(signInBlockOf(new ApiError(500, 'x'))).toBeNull()
  })
})

describe('sign-in states (AccessGate)', () => {
  async function gate(error: unknown) {
    h.perms = { ...permissionsValue([]), error }
    const { AccessGate } = await import('@/components/dashboard/access/AccessGate')
    render(wrap(<AccessGate><p>the dashboard</p></AccessGate>))
  }

  it('not invited: explains access is by invitation and how to ask an Admin — no dashboard', async () => {
    await gate(refused(403, { code: 'not_invited', message: 'x' }))
    const box = screen.getByTestId('sign-in-blocked-not_invited')
    expect(box).toHaveTextContent('Access is by invitation')
    expect(box).toHaveTextContent('You’re signed in as stranger@example.com')
    expect(box).toHaveTextContent('Ask an Admin to send an invitation')
    expect(screen.queryByText('the dashboard')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out and use another account' }))
    expect(h.signOut).toHaveBeenCalledWith({ redirectUrl: '/dashboard/sign-in' })
  })

  it('deactivated: “Your access has been turned off”', async () => {
    await gate(refused(403, 'This account has been deactivated.'))
    expect(screen.getByTestId('sign-in-blocked-deactivated')).toHaveTextContent('Your access has been turned off')
  })

  it('an expired invitation asks for a new one', async () => {
    await gate(refused(403, { code: 'invitation_expired', message: 'x' }))
    expect(screen.getByTestId('sign-in-blocked-invitation_expired')).toHaveTextContent('Ask a Grid Nova Admin to send you a new one')
  })

  it('the identity check being down offers a retry', async () => {
    await gate(refused(503, { code: 'identity_check_unavailable', message: 'x' }))
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('any other error leaves the dashboard to show it', async () => {
    await gate(new ApiError(500, 'x'))
    expect(screen.getByText('the dashboard')).toBeInTheDocument()
  })
})

describe('two-step verification', () => {
  it('the banner shows only while a two-step role has not completed it this session', async () => {
    const { TwoStepBanner } = await import('@/components/dashboard/access/TwoStep')
    h.perms = permissionsValue(['admin'], { twoFactorOk: false })
    const { unmount } = render(<TwoStepBanner />)
    expect(screen.getByTestId('two-step-banner')).toHaveTextContent('Turn on two-step verification')
    unmount()
    h.perms = permissionsValue(['sales'], { twoFactorOk: false })
    render(<TwoStepBanner />)
    expect(screen.queryByTestId('two-step-banner')).not.toBeInTheDocument()
  })

  it('guides through Clerk’s own security settings, then checks again and offers to sign in with the code', async () => {
    const { TwoStepGuide } = await import('@/components/dashboard/access/TwoStep')
    h.perms = permissionsValue(['accounts'], { twoFactorOk: false })
    const user = userEvent.setup()
    render(wrap(<TwoStepGuide />))
    await user.click(screen.getByRole('button', { name: 'Open security settings' }))
    expect(h.openUserProfile).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(h.getToken).toHaveBeenCalledWith({ skipCache: true })
    expect(await screen.findByTestId('two-step-still-needed')).toHaveTextContent('isn’t on yet')
    await user.click(screen.getByRole('button', { name: 'Sign in again with my code' }))
    expect(h.signOut).toHaveBeenCalledWith({ redirectUrl: '/dashboard/sign-in?redirect_url=%2Fdashboard%2Ftwo-step' })
  })

  it('says all set once the session is verified', async () => {
    const { TwoStepGuide } = await import('@/components/dashboard/access/TwoStep')
    h.perms = permissionsValue(['admin'], { twoFactorOk: true })
    render(wrap(<TwoStepGuide />))
    expect(screen.getByTestId('two-step-done')).toHaveTextContent('You’re all set')
  })

  it('a two_factor_required refusal anywhere raises one toast that leads to the setup page', async () => {
    const toast = await import('sonner')
    const spy = vi.spyOn(toast.toast, 'error').mockImplementation(() => 'id')
    const { handleTwoFactorRequired } = await import('@/components/dashboard/QueryProvider')
    const navigate = vi.fn()
    handleTwoFactorRequired(refused(403, { code: 'two_factor_required', message: 'x' }), navigate)
    handleTwoFactorRequired(refused(403, 'Your role cannot do that.'), navigate)
    expect(spy).toHaveBeenCalledTimes(1)
    const opts = spy.mock.calls[0][1] as { id: string; action: { label: string; onClick: () => void } }
    expect(opts).toMatchObject({ id: 'two-factor-required', action: { label: 'Set it up' } })
    opts.action.onClick()
    expect(navigate).toHaveBeenCalledWith('/dashboard/two-step')
  })
})

describe('invitation links', () => {
  it('reads the ticket and status Clerk appends', () => {
    expect(invitationEntry({})).toEqual({ kind: 'no_ticket' })
    expect(invitationEntry({ __clerk_ticket: '  ' })).toEqual({ kind: 'no_ticket' })
    expect(invitationEntry({ __clerk_ticket: 'tk', __clerk_status: 'sign_up' })).toEqual({ kind: 'sign_up', ticket: 'tk' })
    expect(invitationEntry({ __clerk_ticket: ['tk', 'x'] })).toEqual({ kind: 'sign_up', ticket: 'tk' })
    expect(invitationEntry({ __clerk_ticket: 'tk', __clerk_status: 'sign_in' })).toEqual({ kind: 'sign_in', ticket: 'tk' })
    expect(signInWithTicket('/dashboard/sign-in', 'a b')).toBe('/dashboard/sign-in?__clerk_ticket=a%20b')
    expect(clerkErrorCode({ errors: [{ code: 'form_identifier_exists' }] })).toBe('form_identifier_exists')
    expect(clerkErrorCode({ code: 'ticket_expired' })).toBe('ticket_expired')
    expect(isAlreadyRegistered('form_identifier_exists')).toBe(true)
    expect(isAlreadyRegistered('ticket_expired')).toBe(false)
  })
})

describe('/dashboard/sign-up', () => {
  const page = async (searchParams: Record<string, string>) => {
    const { default: Page } = await import('@/app/(internal)/dashboard/sign-up/[[...sign-up]]/page')
    return Page({ searchParams: Promise.resolve(searchParams) })
  }

  it('BE-21: without a link it is an open sign-up (the backend refuses anyone not invited)', async () => {
    render(await page({}))
    const form = await screen.findByTestId('clerk-sign-up')
    expect(form).toHaveAttribute('data-path', '/dashboard/sign-up')
    expect(form).toHaveAttribute('data-after', '/dashboard')
    expect(screen.getByText('Use the email address your invitation was sent to')).toBeInTheDocument()
    expect(h.redirect).not.toHaveBeenCalled()
    expect(h.signUp.ticket).not.toHaveBeenCalled()
  })

  it('an invited address that already has an account signs in with the ticket', async () => {
    await expect(page({ __clerk_ticket: 'tk', __clerk_status: 'sign_in' })).rejects.toThrow('REDIRECT /dashboard/sign-in?__clerk_ticket=tk')
  })

  it('a valid ticket that completes the sign-up signs the person in and lands on the dashboard', async () => {
    h.signUp.ticket.mockImplementation(async () => { h.signUp.status = 'complete'; return { error: null } })
    render(await page({ __clerk_ticket: 'tk', __clerk_status: 'sign_up' }))
    await waitFor(() => expect(h.signUp.finalize).toHaveBeenCalled())
    expect(h.signUp.ticket).toHaveBeenCalledWith({ ticket: 'tk' })
    const navigate = h.signUp.finalize.mock.calls[0][0].navigate as (a: { decorateUrl: (u: string) => string }) => void
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    navigate({ decorateUrl: (u) => u })
    expect(assign).toHaveBeenCalledWith('/dashboard')
    vi.unstubAllGlobals()
  })

  it('when Clerk still needs details, its own sign-up form takes over (same ticket in the URL)', async () => {
    render(await page({ __clerk_ticket: 'tk', __clerk_status: 'sign_up' }))
    const form = await screen.findByTestId('clerk-sign-up')
    expect(form).toHaveAttribute('data-path', '/dashboard/sign-up')
    expect(form).toHaveAttribute('data-after', '/dashboard')
  })

  it('an expired or revoked invitation says so plainly', async () => {
    h.signUp.ticket.mockResolvedValue({ error: { code: 'ticket_expired' } })
    render(await page({ __clerk_ticket: 'old' }))
    expect(await screen.findByTestId('invitation-expired')).toHaveTextContent('This invitation has expired — ask an Admin to send a new one')
  })
})

describe('/[lang]/associates/sign-up', () => {
  const page = async (lang: string, searchParams: Record<string, string>) => {
    const { default: Page } = await import('@/app/(site)/[lang]/associates/sign-up/[[...sign-up]]/page')
    return Page({ params: Promise.resolve({ lang }), searchParams: Promise.resolve(searchParams) })
  }

  it.each([
    ['en', '/associates/portal', 'Create your associate sign-in'],
    ['hi', '/hi/associates/portal', 'अपना एसोसिएट साइन-इन बनाएँ'],
    ['bn', '/bn/associates/portal', 'আপনার অ্যাসোসিয়েট সাইন-ইন তৈরি করুন'],
  ])('%s: no ticket → an open sign-up that lands in the portal (BE-21)', async (lang, portal, title) => {
    render(await page(lang, {}))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
    expect(await screen.findByTestId('clerk-sign-up')).toHaveAttribute('data-after', portal)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  it.each([['en', '/associates/portal', 'Join the Grid Nova Associate portal'], ['hi', '/hi/associates/portal', 'ग्रिड नोवा एसोसिएट पोर्टल से जुड़ें'], ['bn', '/bn/associates/portal', 'গ্রিড নোভা অ্যাসোসিয়েট পোর্টালে যোগ দিন']])('%s: a valid ticket lands in the portal', async (lang, portal, title) => {
    render(await page(lang, { __clerk_ticket: 'tk' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
    expect(await screen.findByTestId('clerk-sign-up')).toHaveAttribute('data-after', portal)
  })

  it('an expired invitation says so in the reader’s language', async () => {
    h.signUp.ticket.mockResolvedValue({ error: { errors: [{ code: 'invitation_revoked' }] } })
    render(await page('hi', { __clerk_ticket: 'old' }))
    expect(await screen.findByTestId('invitation-expired')).toHaveTextContent('इस निमंत्रण की अवधि समाप्त हो गई है')
  })

  it('someone already signed in goes straight to the portal', async () => {
    h.auth = { isLoaded: true, isSignedIn: true }
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    await act(async () => { render(await page('en', { __clerk_ticket: 'tk' })) })
    expect(assign).toHaveBeenCalledWith('/associates/portal')
    expect(h.signUp.ticket).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
