// FE-21 (BE-21): sign-in on Clerk's free plan — offboarding by session revoke (clerk_mode),
// invitations Clerk could not send (delivery "manual"), and an associate linking their own
// sign-up to their account (POST /associate/me/claim).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/dashboard/api-error'
import { parseApiError } from '@/lib/api/http'
import { clerkOutcome } from '@/lib/access/offboarding'
import { accessChangeLines } from '@/lib/associate/staff-associates'
import { claimErrorText } from '@/lib/associate/portal-error'
import { signInMessage } from '@/components/dashboard/ShareSignInCard'
import { ManualSignUpNote } from '@/components/dashboard/access/ManualSignUpNote'
import { ClaimAccountNotice } from '@/components/associate/ClaimAccountNotice'
import { PortalError } from '@/components/associate/PortalError'
import { loadOpenApi } from './helpers/openapi'
import { en, withI18n } from './helpers/i18n'
import { deactivated } from './fixtures/access-contract'

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  reload: vi.fn(async () => undefined),
  getToken: vi.fn<(opts?: { skipCache?: boolean }) => Promise<string | null>>(async () => 'tok'),
  fetch: vi.fn(),
}))
vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: h.signOut, session: { reload: h.reload } }),
  useAuth: () => ({ getToken: h.getToken }),
}))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)
vi.mock('@/lib/dashboard/api-client', () => ({ dashboardFetch: (...a: unknown[]) => h.fetch(...a) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const copy = en.portalFeedback.claim
const refused = (status: number, detail: unknown) => parseApiError(status, 'x', JSON.stringify({ detail }))
const root = path.resolve(__dirname, '../..')

beforeEach(() => {
  vi.clearAllMocks()
  h.getToken.mockResolvedValue('tok')
})

describe('offboarding: what Clerk did (clerk_mode)', () => {
  it('session revoke is reported as done, never as a failed ban', () => {
    expect(clerkOutcome(deactivated({ sessions_revoked: 3 }))).toBe(', and all 3 open sessions have been ended.')
    expect(clerkOutcome(deactivated({ sessions_revoked: 1 }))).toBe(', and their open session has been ended.')
    expect(clerkOutcome(deactivated({ sessions_revoked: 0 }))).toBe('; they had no open sessions.')
    expect(clerkOutcome(deactivated({ sessions_revoked: null }))).toBe('.')
  })
  it('ban mode (Clerk Pro) and a Clerk failure', () => {
    expect(clerkOutcome(deactivated({ clerk_mode: 'ban', clerk_banned: true, sessions_revoked: null }))).toMatch(/sign-in is blocked/)
    expect(clerkOutcome(deactivated({ clerk_error: 'down' }))).toBe('.')
  })
  it('an associate’s sessions ended is one sentence; a ban is still described', () => {
    expect(accessChangeLines({ clerk_banned: false, sessions_revoked: 2, invitation_revoked: false, clerk_error: null, clerk_mode: 'revoke_sessions' }))
      .toEqual(['All 2 of their open sessions were ended. Grid Nova refuses them from their next request.'])
    expect(accessChangeLines({ clerk_banned: false, sessions_revoked: 0, clerk_error: null, clerk_mode: 'revoke_sessions' })[0]).toMatch(/no open sessions/)
    expect(accessChangeLines({ clerk_banned: true, sessions_revoked: null, clerk_error: null, clerk_mode: 'ban' }))
      .toEqual(['Their sign-in is blocked and every open session has ended.'])
    // Reinstating with sessions revoked: nothing changed in Clerk.
    expect(accessChangeLines({ clerk_unbanned: false, clerk_error: null, clerk_mode: 'revoke_sessions' })).toEqual(['Their sign-in did not need changing.'])
  })
})

describe('manual invitations (delivery "manual")', () => {
  it('shows the backend’s sentence and copies it', async () => {
    const user = userEvent.setup()   // installs its own clipboard; spy on it after
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const text = 'Ask Asha to sign up at https://www.gridnova.in/dashboard/sign-up with a@gmail.com.'
    render(<ManualSignUpNote instructions={text} />)
    expect(screen.getByTestId('manual-sign-up')).toHaveTextContent('No invitation email was sent.')
    expect(screen.getByTestId('manual-sign-up')).toHaveTextContent(text)
    await user.click(screen.getByRole('button', { name: /Copy the instructions/ }))
    expect(writeText).toHaveBeenCalledWith(text)
  })

  it('the WhatsApp message for an associate without an invitation says to sign up, then link', () => {
    const msg = signInMessage({ fullName: 'Sourav Ghosh', associateId: 'GNA-WB-26-00001', type: 'associate', email: 's@example.com', manualSignUp: true })
    expect(msg).toContain('Sign up here with s@example.com: https://www.gridnova.in/associates/sign-up')
    expect(msg).toContain('Link my account')
    expect(msg).not.toContain('invitation email')
  })
})

describe('associate claim (POST /associate/me/claim)', () => {
  it('the route is in the contract', () => {
    expect(loadOpenApi().paths['/api/v1/associate/me/claim']?.post).toBeDefined()
    const doc = readFileSync(path.join(root, 'docs/api/associate_journeys.md'), 'utf8')
    for (const code of ['claim_not_allowed', 'rate_limited', 'clerk_sync_failed', 'identity_check_unavailable']) expect(doc).toContain(code)
  })

  it('a sign-in that is not an associate yet is offered the claim in the portal', () => {
    render(withI18n(<PortalError error={new ApiError(403, 'x', 'This endpoint is for Grid Nova associates only.')} />))
    expect(screen.getByTestId('claim-account')).toHaveTextContent(copy.title)
    expect(screen.getByRole('button', { name: copy.signOut })).toBeInTheDocument()
  })

  it('linking calls the claim, refreshes the session and reloads the page', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    h.fetch.mockResolvedValue({ associate_id: 'GNA-WB-26-00012', refresh_session: true })
    render(withI18n(<ClaimAccountNotice />))
    await userEvent.setup().click(screen.getByTestId('claim-button'))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(h.fetch).toHaveBeenCalledWith('/api/v1/associate/me/claim', 'tok', { method: 'POST' })
    expect(h.reload).toHaveBeenCalled()
    expect(h.getToken).toHaveBeenCalledWith({ skipCache: true })
    expect(screen.getByTestId('claim-linked')).toHaveTextContent(copy.linked)
    vi.unstubAllGlobals()
  })

  it('a refusal says what to do, and nothing reloads', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    h.fetch.mockRejectedValue(refused(403, { code: 'claim_not_allowed', message: '…' }))
    render(withI18n(<ClaimAccountNotice />))
    await userEvent.setup().click(screen.getByTestId('claim-button'))
    expect(await screen.findByTestId('claim-error')).toHaveTextContent(copy.notAllowed)
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByTestId('claim-button')).toBeEnabled()
    vi.unstubAllGlobals()
  })

  it('every claim error is a plain sentence', () => {
    expect(claimErrorText(refused(403, { code: 'claim_not_allowed' }), copy)).toBe(copy.notAllowed)
    expect(claimErrorText(refused(429, { code: 'rate_limited' }), copy)).toBe(copy.rateLimited)
    expect(claimErrorText(refused(502, { code: 'clerk_sync_failed' }), copy)).toBe(copy.unavailable)
    expect(claimErrorText(refused(503, { code: 'identity_check_unavailable' }), copy)).toBe(copy.unavailable)
  })

  it('signing out of a staff account goes to the associate sign-in, on click only', async () => {
    render(withI18n(<ClaimAccountNotice />))
    expect(h.signOut).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: copy.signOut }))
    expect(h.signOut).toHaveBeenCalledWith({ redirectUrl: '/associates/sign-in' })
  })

  it('the claim copy exists in every language', () => {
    for (const lang of ['hi', 'bn']) {
      const m = JSON.parse(readFileSync(path.join(root, `messages/${lang}.json`), 'utf8'))
      expect(Object.keys(m.portalFeedback.claim).sort()).toEqual(Object.keys(copy).sort())
      expect(m.associates.signUp.openTitle).toBeTruthy()
    }
  })
})
