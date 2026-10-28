import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/dashboard/api-error'
import { accessChangeLines, canSendInvite, inviteStateOf, staffAssociateError, onboardingIdsOf } from '@/lib/associate/staff-associates'

// FE-19 item 10, staff side (associate_journeys.md §§1–4): invitation re-send, what a status
// change did to sign-in, frozen commission, moving customers, and applicant-facing text.

const h = vi.hoisted(() => ({
  associate: null as unknown,
  application: null as unknown,
  setStatus: vi.fn(),
  invite: vi.fn(),
  move: vi.fn(),
  setAppStatus: vi.fn(),
  candidates: { items: [] as unknown[], total: 0 },
  params: { id: 'GNA-WB-26-00001', type: 'associate' } as Record<string, string>,
}))
vi.mock('@/lib/associate/api-client', async (orig) => ({
  ...(await orig<object>()),
  useAdminAssociate: () => ({ data: h.associate, isLoading: false, error: null, refetch: vi.fn() }),
  useAdminAssociates: () => ({ data: { ...h.candidates, page: 1, page_size: 100 }, isLoading: false, error: null, refetch: vi.fn() }),
  useSetAssociateStatus: () => ({ mutateAsync: h.setStatus, isPending: false }),
  useRetryClerkInvite: () => ({ mutate: (id: string, o: { onSuccess?: () => void; onError?: (e: unknown) => void }) => h.invite(id, o), isPending: false }),
  useRegenerateAssociateDocuments: () => ({ mutate: vi.fn(), isPending: false }),
  useReassignCustomers: () => ({ mutateAsync: h.move, isPending: false }),
  fetchAdminAssociateDocumentLink: vi.fn(),
  useAssociateApplication: () => ({ data: h.application, isLoading: false, error: null, refetch: vi.fn() }),
  useSetApplicationStatus: () => ({ mutateAsync: h.setAppStatus, isPending: false }),
  useApproveApplication: () => ({ mutateAsync: vi.fn(), isPending: false }),
  fetchApplicationDocumentLink: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useParams: () => h.params, useRouter: () => ({ push: vi.fn() }), usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/commissions/staff-api-client', () => ({
  useAssociateRate: () => ({ data: undefined, isLoading: true }),
  useSetAssociateRate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssociatePerformance: () => ({ data: undefined, isLoading: true }),
}))
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { publicMetadata: { role: 'admin' }, firstName: 'Ann', emailAddresses: [] } }),
  useAuth: () => ({ getToken: async () => 't' }),
  useClerk: () => ({ signOut: vi.fn() }),
}))

import AssociateDetailPage from '@/app/(internal)/dashboard/associate-network/associates/[id]/page'
import MoveCustomersPage from '@/app/(internal)/dashboard/associate-network/associates/[id]/move-customers/page'
import ApplicationDetailPage from '@/app/(internal)/dashboard/associate-network/[type]/[id]/page'

const associate = (over: Record<string, unknown> = {}) => ({
  associate_id: 'GNA-WB-26-00001', full_name: 'Bikash Das', status: 'active', status_reason: null, email: 'b@example.com', mobile: '9', associate_type: 'associate',
  capability: 'sales', level: null, territory: 'Hooghly', approved_at: '2026-01-01T00:00:00Z', clerk_user_bound: false, seat: null,
  clerk_invite_status: 'sent', documents: { id_card: true, welcome_letter: true, generated_at: 'x', error: null }, ...over,
})

describe('helpers', () => {
  it('invitation state in plain words, and when it can be sent again', () => {
    expect(inviteStateOf({ clerk_user_bound: true, clerk_invite_status: 'sent' })).toBe('signed_in')
    expect(inviteStateOf({ clerk_user_bound: false, clerk_invite_status: null })).toBe('none')
    expect(canSendInvite({ status: 'active', clerk_user_bound: false })).toBe(true)
    expect(canSendInvite({ status: 'active', clerk_user_bound: true })).toBe(false)
    expect(canSendInvite({ status: 'suspended', clerk_user_bound: false })).toBe(false)
  })

  it('every access outcome is a sentence; a Clerk error says the change still stands', () => {
    expect(accessChangeLines({ clerk_banned: true, invitation_revoked: false, clerk_error: null })).toEqual(['Their sign-in is blocked and every open session has ended.'])
    expect(accessChangeLines({ clerk_banned: false, invitation_revoked: true, clerk_error: null })[0]).toMatch(/invitation was revoked/)
    expect(accessChangeLines({ clerk_unbanned: true, clerk_error: null })).toEqual(['Their sign-in works again.'])
    expect(accessChangeLines({ clerk_banned: false, invitation_revoked: false, clerk_error: 'timeout' })[0]).toMatch(/change still stands/)
    expect(accessChangeLines(null)).toEqual(['Their sign-in did not need changing.'])
  })

  it.each(['associate_active', 'target_not_active', 'same_associate', 'reason_required', 'unknown_customers', 'nothing_to_move', 'target_cannot_execute'])(
    'reassign-customers %s has its own sentence',
    (code) => {
      const text = staffAssociateError(new ApiError(409, 'x', 'English', { code }), 'fallback')
      expect(text).not.toBe('English')
      expect(text).not.toBe('fallback')
    },
  )

  it('outside the regions, unknown associate and offline are plain', () => {
    expect(staffAssociateError(new ApiError(403, 'x', 'This record is outside the regions you work in.'), 'f')).toMatch(/outside the regions you work in/)
    expect(staffAssociateError(new ApiError(404, 'x', 'Associate not found.'), 'f')).toMatch(/could not be found/)
    expect(staffAssociateError(new ApiError(0, 'x'), 'f')).toMatch(/Can’t reach the server/)
    expect(onboardingIdsOf(new ApiError(409, 'x', 'y', { code: 'target_cannot_execute', onboarding_ids: [4, 9] }))).toEqual([4, 9])
  })
})

describe('associate detail', () => {
  beforeEach(() => {
    h.setStatus.mockReset()
    h.invite.mockReset()
  })

  it('a sent but unaccepted invitation can be sent again, after saying the old link stops working', async () => {
    h.associate = associate()
    const user = userEvent.setup()
    render(<AssociateDetailPage />)
    expect(screen.getByTestId('invite-state')).toHaveTextContent('Sent — not accepted yet')
    await user.click(screen.getByRole('button', { name: 'Send invitation again' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('The link sent before stops working')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Send invitation' }))
    expect(h.invite).toHaveBeenCalledWith('GNA-WB-26-00001', expect.anything())
  })

  it('once they have signed in there is no invitation to send', () => {
    h.associate = associate({ clerk_user_bound: true })
    render(<AssociateDetailPage />)
    expect(screen.queryByRole('button', { name: /Send invitation/ })).toBeNull()
  })

  it('suspending says what happens first, then shows what happened to sign-in and the open customers, with Move customers', async () => {
    h.associate = associate()
    h.setStatus.mockResolvedValue({ ...associate({ status: 'suspended' }), access: { clerk_banned: true, invitation_revoked: false, clerk_error: null }, open_customers: 3 })
    const user = userEvent.setup()
    render(<AssociateDetailPage />)
    await user.click(screen.getByRole('button', { name: 'Suspend' }))
    expect(screen.getByTestId('suspend-effects')).toHaveTextContent('Commission is frozen')
    await user.type(screen.getByLabelText('Reason for suspension'), 'Customer complaint under review')
    await user.click(screen.getByRole('button', { name: 'Confirm suspend' }))
    const result = await screen.findByTestId('status-result')
    expect(result).toHaveTextContent('Their sign-in is blocked and every open session has ended.')
    expect(screen.getByTestId('open-customers')).toHaveTextContent('They still own 3 open customers')
    expect(within(result).getByRole('link', { name: 'Move customers' })).toHaveAttribute('href', '/dashboard/associate-network/associates/GNA-WB-26-00001/move-customers')
  })

  it('a suspended associate shows the frozen-commission notice and the way to move customers', () => {
    h.associate = associate({ status: 'suspended', status_reason: 'Review' })
    render(<AssociateDetailPage />)
    expect(screen.getByTestId('commission-frozen')).toHaveTextContent('paid in the first batch after they are reinstated')
    expect(within(screen.getByTestId('move-customers-card')).getByRole('link')).toHaveAttribute('href', expect.stringContaining('/move-customers'))
  })

  it('reinstating after a revoked invitation says a new invitation must be sent', async () => {
    h.associate = associate({ status: 'suspended', clerk_invite_status: null })
    h.setStatus.mockResolvedValue({ ...associate({ status: 'active', clerk_invite_status: null }), access: { clerk_unbanned: false, clerk_error: null }, open_customers: 0 })
    const user = userEvent.setup()
    render(<AssociateDetailPage />)
    await user.click(screen.getByRole('button', { name: 'Reinstate' }))
    expect(await screen.findByTestId('new-invite-needed')).toHaveTextContent('Send a new invitation')
  })
})

describe('Move customers', () => {
  beforeEach(() => {
    h.move.mockReset()
    h.associate = associate({ status: 'suspended' })
    h.candidates = {
      items: [associate(), associate({ associate_id: 'GNA-WB-26-00002', full_name: 'Rina Sen', status: 'active', territory: 'Howrah' }), associate({ associate_id: 'GNA-WB-26-00003', full_name: 'Amit Paul', associate_type: 'preferred_associate', capability: null, level: 'district_head' })],
      total: 3,
    }
  })

  it('offers the active associates in the viewer’s regions, never the associate themselves', () => {
    render(<MoveCustomersPage />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['GNA-WB-26-00002', 'GNA-WB-26-00003'])
  })

  it('needs a target and a reason before calling', async () => {
    const user = userEvent.setup()
    render(<MoveCustomersPage />)
    await user.click(screen.getByRole('button', { name: 'Move every open customer' }))
    expect(screen.getByTestId('move-error')).toHaveTextContent('Choose the associate')
    await user.click(screen.getByRole('radio', { name: /Rina Sen/ }))
    await user.click(screen.getByRole('button', { name: /Move every open customer/ }))
    expect(screen.getByTestId('move-error')).toHaveTextContent('Please give a reason')
    expect(h.move).not.toHaveBeenCalled()
  })

  it('moves every open customer (onboarding_ids omitted) and lists them', async () => {
    h.move.mockResolvedValue({ from_associate_id: 'GNA-WB-26-00001', to_associate_id: 'GNA-WB-26-00002', onboarding_ids: [4, 9], moved: 2 })
    const user = userEvent.setup()
    render(<MoveCustomersPage />)
    await user.click(screen.getByRole('radio', { name: /Rina Sen/ }))
    await user.type(screen.getByLabelText('Reason (required)'), 'Bikash is suspended')
    await user.click(screen.getByRole('button', { name: 'Move every open customer to Rina Sen' }))
    expect(h.move).toHaveBeenCalledWith({ associateId: 'GNA-WB-26-00001', input: { to_associate_id: 'GNA-WB-26-00002', reason: 'Bikash is suspended' } })
    const done = await screen.findByTestId('move-done')
    expect(done).toHaveTextContent('2 customers moved to Rina Sen')
    expect(within(done).getByRole('link', { name: 'Customer #9' })).toHaveAttribute('href', '/dashboard/onboardings/9')
  })

  it('target_cannot_execute: says why and links the customers concerned', async () => {
    h.move.mockRejectedValue(new ApiError(409, 'x', 'English', { code: 'target_cannot_execute', onboarding_ids: [9] }))
    const user = userEvent.setup()
    render(<MoveCustomersPage />)
    await user.click(screen.getByRole('radio', { name: /Rina Sen/ }))
    await user.type(screen.getByLabelText('Reason (required)'), 'x')
    await user.click(screen.getByRole('button', { name: /Move every open customer/ }))
    const err = await screen.findByTestId('move-error')
    expect(err).toHaveTextContent('may not run execution')
    expect(within(err).getByRole('link', { name: 'Customer #9' })).toBeInTheDocument()
  })

  it('an active associate’s customers are never moved', () => {
    h.associate = associate({ status: 'active' })
    render(<MoveCustomersPage />)
    expect(screen.getByTestId('move-active')).toHaveTextContent('never moved')
    expect(screen.queryByRole('button', { name: /Move every open customer/ })).toBeNull()
  })
})

describe('application review: the text is emailed to the applicant', () => {
  const app = (over: Record<string, unknown> = {}) => ({
    application_id: 7, application_type: 'associate', status: 'under_review', full_name: 'Sourav Ghosh', mobile: '98300 12345',
    email: 'sourav@example.com', submitted_at: '2026-10-01T00:00:00Z', status_changed_at: '2026-10-02T00:00:00Z',
    address_territory: { state: { name: 'West Bengal' }, district: { name: 'Hooghly' }, block: null }, associate_id: null,
    date_of_birth: '1990-01-01', address_line: 'x', pin_code: '712101', aadhaar_last4: '1234', pan: 'ABCPE1234F', bank_account_last4: '9999',
    bank_ifsc: 'SBIN0001234', kyc_consent_version: '1', kyc_consent_accepted_at: '2026-10-01T00:00:00Z', documents: [], needs_info_note: null,
    rejection_reason: null, verification_call_completed: false, verification_call_note: null, decided_at: null, decided_by_employee_id: null, ...over,
  })
  beforeEach(() => {
    h.params = { id: '7', type: 'associate' }
    h.setAppStatus.mockReset().mockResolvedValue({})
  })

  it('the rejection reason is labelled "shown to the applicant" and previewed as their email reads it', async () => {
    h.application = app()
    const user = userEvent.setup()
    render(<ApplicationDetailPage />)
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.type(screen.getByLabelText('Reason — shown to the applicant'), 'The PAN card photo is not readable.')
    expect(screen.getByTestId('applicant-preview')).toHaveTextContent('Reason: The PAN card photo is not readable.')
    await user.click(screen.getByRole('button', { name: 'Reject and email the applicant' }))
    await waitFor(() => expect(h.setAppStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected', note: 'The PAN card photo is not readable.' })))
  })

  it('the needs-info note is labelled and previewed too', async () => {
    h.application = app()
    const user = userEvent.setup()
    render(<ApplicationDetailPage />)
    await user.click(screen.getByRole('button', { name: 'Request more info' }))
    await user.type(screen.getByLabelText('Note — shown to the applicant'), 'Please send a clearer cheque photo.')
    expect(screen.getByTestId('applicant-preview')).toHaveTextContent('Please send a clearer cheque photo.')
    expect(screen.getByRole('button', { name: 'Email the applicant' })).toBeEnabled()
  })

  it('a decided application says the text went to the applicant', () => {
    h.application = app({ status: 'rejected', rejection_reason: 'Not readable' })
    render(<ApplicationDetailPage />)
    expect(screen.getByText(/reason sent to the applicant/)).toBeInTheDocument()
  })
})
