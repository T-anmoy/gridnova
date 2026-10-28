// FE-18: the proposal page after issue (timeline, actions by permission, WhatsApp link,
// versions and Compare), the approver's review (maker ≠ checker), Studio Home, the Proposal
// Desk's landing and the page guards per role.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProposalOverview } from '@/components/dashboard/studio/ProposalOverview'
import { ApprovalReview } from '@/components/dashboard/studio/ApprovalReview'
import StudioHome from '@/components/dashboard/studio/StudioHome'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import DashboardOverview from '@/app/(internal)/dashboard/page'
import type { StudioView } from '@/lib/studio/types'
import { asRoles } from './helpers/permissions-bridge'
import { navState, push, replace } from './helpers/mock-navigation'
import { issuedView, makeView, refused, studioBackend } from './fixtures/studio'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: () => Promise.resolve('token') }), useUser: () => ({ user: { firstName: 'Test', publicMetadata: {} } }) }))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

const P = '/dashboard/studio/proposals/7'

const EVENTS = {
  items: [
    { id: 1, version: 1, type: 'created', actor_type: 'employee', actor: 'user_test', detail: null, at: '2026-10-27T05:00:00+00:00' },
    { id: 2, version: 1, type: 'edited', actor_type: 'employee', actor: 'user_test', detail: null, at: '2026-10-27T05:05:00+00:00' },
    { id: 3, version: 1, type: 'issued', actor_type: 'employee', actor: 'user_test', detail: null, at: '2026-10-27T06:00:00+00:00' },
    { id: 4, version: 1, type: 'emailed', actor_type: 'employee', actor: 'user_test', detail: { to: 'test@example.com' }, at: '2026-10-27T06:01:00+00:00' },
    { id: 5, version: 1, type: 'viewed', actor_type: 'customer', actor: null, detail: null, at: '2026-10-27T08:00:00+00:00' },
    { id: 6, version: 1, type: 'viewed', actor_type: 'customer', actor: null, detail: null, at: '2026-10-28T09:00:00+00:00' },
  ],
}

function renderWith(node: React.ReactNode, roles: string[] = ['proposal_desk']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user = userEvent.setup()
  render(asRoles(roles, <QueryClientProvider client={qc}>{node}</QueryClientProvider>))
  return { user, qc }
}

function backendFor(view: StudioView, extra: Parameters<typeof studioBackend>[0] = {}) {
  return studioBackend({
    [`GET ${P}/events`]: { body: EVENTS },
    'GET /dashboard/studio/customers/3': { body: { customer: { id: 3, customer_type: 'individual', title: 'Mr.', name: 'Test Kumar Das', attention: null, mobile: '9830000001', email: 'test@example.com', address_lines: [], gstin: null }, duplicates: [] } },
    [`GET ${P}/preview.pdf`]: { raw: '%PDF', type: 'application/pdf' },
    ...extra,
  })
}

beforeEach(() => {
  navState.reset(P)
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

describe('the proposal page after issue', () => {
  it('timeline from the events: issued, emailed, each customer view with its time (edits left out)', async () => {
    const view = issuedView({ version: { view_count: 2, first_viewed_at: '2026-10-27T08:00:00+00:00' } })
    backendFor(view)
    renderWith(<ProposalOverview view={view} justIssued />)
    const tl = await screen.findByTestId('timeline')
    await waitFor(() => expect(within(tl).getAllByRole('listitem').length).toBeGreaterThan(3))
    const text = tl.textContent ?? ''
    expect(text).toContain('Issued')
    expect(text).toContain('Emailed to the customer')
    expect(within(tl).getAllByText('Opened by the customer')).toHaveLength(2)
    expect(text).toContain('To test@example.com')
    expect(text).not.toContain('Edited')
    expect(text).toContain('Opened 2 times in all')
    expect(screen.getByTestId('issued-banner')).toHaveTextContent('GN/27/10/2026/01')
  })

  it('actions follow the API’s `can` for this person', () => {
    const view = issuedView()
    backendFor(view)
    renderWith(<ProposalOverview view={view} justIssued={false} />)
    const actions = screen.getByTestId('proposal-actions')
    for (const id of ['action-download', 'action-email', 'action-whatsapp', 'action-copy-link', 'action-accepted', 'action-revise', 'action-duplicate', 'action-convert', 'action-lost', 'action-template']) {
      expect(within(actions).getByTestId(id)).toBeInTheDocument()
    }
    expect(within(actions).queryByTestId('action-review')).not.toBeInTheDocument()
  })

  it('Management (views and approves only) gets no sending, revising or lead actions', () => {
    const view = issuedView({ can: { deliver: false, revise: false, mark_accepted: false, mark_lost: false, convert: false } })
    backendFor(view)
    renderWith(<ProposalOverview view={view} justIssued={false} />, ['management'])
    const actions = screen.getByTestId('proposal-actions')
    expect(within(actions).getByTestId('action-download')).toBeInTheDocument()
    for (const id of ['action-email', 'action-whatsapp', 'action-revise', 'action-duplicate', 'action-convert', 'action-lost', 'action-template']) {
      expect(within(actions).queryByTestId(id)).not.toBeInTheDocument()
    }
  })

  it('Share on WhatsApp opens the API’s wa.me link', async () => {
    const view = issuedView()
    const url = 'https://wa.me/919830000001?text=Dear%20Mr.%20Test%20Kumar%20Das'
    const backend = backendFor(view, { [`POST ${P}/whatsapp-link`]: { body: { url, text: 'Dear…', link: 'https://www.gridnova.in/proposal/tok' } } })
    const win = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await user.click(screen.getByTestId('action-whatsapp'))
    await waitFor(() => expect(win.location.href).toBe(url))
    expect(backend.called('POST', `${P}/whatsapp-link`)).toHaveLength(1)
  })

  it('a link that is not wa.me is never opened', async () => {
    const view = issuedView()
    backendFor(view, { [`POST ${P}/whatsapp-link`]: { body: { url: 'https://evil.example/', text: '', link: '' } } })
    const win = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await user.click(screen.getByTestId('action-whatsapp'))
    await waitFor(() => expect(win.close).toHaveBeenCalled())
    expect(win.location.href).toBe('')
  })

  it('Copy link uses the link from issue without another call', async () => {
    const view = issuedView()
    const backend = backendFor(view)
    const { user, qc } = renderWith(<ProposalOverview view={view} justIssued />)
    // user-event installs its own clipboard on setup; watch that one.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    qc.setQueryData(['studio', 'public-url', 7], 'https://www.gridnova.in/proposal/tok')
    await user.click(screen.getByTestId('action-copy-link'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://www.gridnova.in/proposal/tok'))
    expect(backend.called('POST', `${P}/whatsapp-link`)).toHaveLength(0)
  })

  it('Email: pre-filled with the customer’s address, editable; another address is sent as `to`', async () => {
    const view = issuedView()
    const backend = backendFor(view, { [`POST ${P}/email`]: { body: { sent: true, to: 'other@example.com' } } })
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await waitFor(() => expect(backend.called('GET', '/dashboard/studio/customers/3')).toHaveLength(1))
    await user.click(screen.getByTestId('action-email'))
    const to = await screen.findByLabelText(/Send to/)
    await waitFor(() => expect(to).toHaveValue('test@example.com'))
    await user.clear(to)
    await user.type(to, 'other@example.com')
    await user.click(screen.getByTestId('email-send'))
    await waitFor(() => expect(backend.called('POST', `${P}/email`)[0]?.body).toEqual({ to: 'other@example.com' }))
  })

  it('Email: no address on file → the API’s no_customer_email is explained in the dialog', async () => {
    const view = issuedView()
    backendFor(view, { [`POST ${P}/email`]: refused(422, 'no_customer_email') })
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await user.click(screen.getByTestId('action-email'))
    await user.click(await screen.findByTestId('email-send'))
    expect(await screen.findByText(/This customer has no email address/)).toBeInTheDocument()
  })

  it('Mark lost needs a reason', async () => {
    const view = issuedView()
    const backend = backendFor(view, { [`POST ${P}/mark-lost`]: { body: { ...view, proposal: { ...view.proposal, status: 'lost', lost_reason: 'Went with another installer' } } } })
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await user.click(screen.getByTestId('action-lost'))
    const confirm = await screen.findByRole('button', { name: /^Mark lost$/ })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Why was it lost?'), 'Went with another installer')
    await user.click(confirm)
    await waitFor(() => expect(backend.called('POST', `${P}/mark-lost`)[0]?.body).toEqual({ reason: 'Went with another installer' }))
  })

  it('Mark accepted in person: the date and the signed copy go as multipart', async () => {
    const view = issuedView()
    const backend = backendFor(view, { [`POST ${P}/mark-accepted`]: { body: { ...view, convert_offered: false } } })
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await user.click(screen.getByTestId('action-accepted'))
    await user.upload(await screen.findByLabelText('Signed copy'), new File(['%PDF'], 'signed.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    await waitFor(() => expect(backend.called('POST', `${P}/mark-accepted`)).toHaveLength(1))
    const form = backend.called('POST', `${P}/mark-accepted`)[0].form!
    expect(form.get('accepted_on')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((form.get('signed_copy') as File).name).toBe('signed.pdf')
  })

  it('Revise starts the next version and opens it in the wizard', async () => {
    const view = issuedView()
    const backend = backendFor(view, { [`POST ${P}/revise`]: { body: makeView({ version: { version: 2 } }) } })
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await user.click(screen.getByTestId('action-revise'))
    await user.click(await screen.findByRole('button', { name: 'Start the new version' }))
    await waitFor(() => expect(backend.called('POST', `${P}/revise`)).toHaveLength(1))
    expect(push).toHaveBeenCalledWith(`${P}?step=review`)
  })

  it('Versions: Compare shows the field diff', async () => {
    const view = issuedView({
      versions: [{ version: 1, status: 'superseded', document_reference: 'GN/27/10/2026/01' }, { version: 2, status: 'issued', document_reference: 'GN/27/10/2026/01-R1' }],
      version: { version: 2 },
      proposal: { current_version: 2 },
    })
    backendFor(view, { [`GET ${P}/versions/1/diff/2`]: { body: { from: 1, to: 2, changes: [{ field: 'plant.capacity_kwp', before: '3', after: '4' }, { field: 'price.basic', before: '185000', after: '230000' }] } } })
    const { user } = renderWith(<ProposalOverview view={view} justIssued={false} />)
    await user.click(screen.getByTestId('compare-2'))
    const cmp = await screen.findByTestId('compare-view')
    await waitFor(() => expect(cmp).toHaveTextContent('Capacity (kWp)'))
    expect(cmp).toHaveTextContent('Basic price')
    expect(within(cmp).getAllByRole('row')).toHaveLength(3)
  })
})

describe('approval review (studio.approve, maker ≠ checker)', () => {
  const pending = (can: Partial<NonNullable<StudioView['can']>>) =>
    makeView({
      version: { status: 'pending_approval' },
      approval_required: true,
      approval_reasons: ['price_below_price_master'],
      figures: { below_price_master: { list_basic: '185000', basic: '170000', percent: '8.11' }, discount: { price_before_discount: '185000.00', amount: '15000.00', reason: 'Festival offer' } },
      can,
    })

  it('shows why, the discount and its reason, and approves with a comment', async () => {
    const view = pending({ approve: true })
    const backend = backendFor(view, { [`POST ${P}/approve`]: { body: { ...view, version: { ...view.version, status: 'ready' } } } })
    const { user } = renderWith(<ApprovalReview view={view} />, ['management'])
    expect(screen.getByTestId('approval-reasons')).toHaveTextContent('The price is below the price master')
    expect(screen.getByTestId('review-discount')).toHaveTextContent('₹15,000.00')
    expect(screen.getByTestId('review-discount')).toHaveTextContent('Festival offer')
    await user.type(screen.getByLabelText('Comment'), 'OK for festival')
    await user.click(screen.getByTestId('approve'))
    await waitFor(() => expect(backend.called('POST', `${P}/approve`)[0]?.body).toEqual({ comment: 'OK for festival' }))
  })

  it('sending back needs a comment', async () => {
    const view = pending({ approve: true })
    const backend = backendFor(view, { [`POST ${P}/reject`]: { body: view } })
    const { user } = renderWith(<ApprovalReview view={view} />, ['admin'])
    expect(screen.getByTestId('reject')).toBeDisabled()
    await user.type(screen.getByLabelText('Comment'), 'Keep the price master')
    await user.click(screen.getByTestId('reject'))
    await waitFor(() => expect(backend.called('POST', `${P}/reject`)[0]?.body).toEqual({ comment: 'Keep the price master' }))
  })

  it('the preparer (can.approve false) is told someone else must approve, and gets no buttons', () => {
    backendFor(pending({ approve: false }))
    renderWith(<ApprovalReview view={pending({ approve: false })} />, ['admin'])
    expect(screen.getByTestId('maker-checker')).toHaveTextContent('someone else must approve it')
    expect(screen.queryByTestId('approve')).not.toBeInTheDocument()
  })

  it('a maker_checker refusal from the server is shown in words', async () => {
    const view = pending({ approve: true })
    backendFor(view, { [`POST ${P}/approve`]: refused(403, 'maker_checker') })
    const { user } = renderWith(<ApprovalReview view={view} />, ['admin'])
    await user.click(screen.getByTestId('approve'))
    expect(await screen.findByText(/You prepared this version, so someone else must approve it/)).toBeInTheDocument()
  })

  it('shows what changed since the last issued version', async () => {
    const view = makeView({
      version: { version: 2, status: 'pending_approval' }, proposal: { current_version: 2 }, approval_required: true, approval_reasons: ['total_above_threshold'], can: { approve: true },
      versions: [{ version: 1, status: 'issued', document_reference: 'GN/27/10/2026/01' }, { version: 2, status: 'pending_approval', document_reference: null }],
    })
    backendFor(view, { [`GET ${P}/versions/1/diff/2`]: { body: { from: 1, to: 2, changes: [{ field: 'plant.capacity_kwp', before: '3', after: '52' }] } } })
    renderWith(<ApprovalReview view={view} />, ['management'])
    expect(await screen.findByTestId('review-diff')).toHaveTextContent('Capacity (kWp): 3 → 52')
  })
})

describe('Studio Home', () => {
  const SUMMARY = { drafts: 4, awaiting_approval: 2, issued_this_month: { count: 3, value: '604395.00' }, viewed_not_accepted: 1, accepted: { count: 2, value: '402930.00' }, win_rate_90_days: 0.4, expiring_in_7_days: 1, median_days_issued_to_accepted: 3.5, owner_id: null }
  const list = (items: StudioView['proposal'][]) => ({ body: { items, total: items.length, page: 1, page_size: 25 } })
  const routes = (pendingItems: StudioView['proposal'][] = []) => ({
    'GET /dashboard/studio/summary': { body: SUMMARY },
    'GET /dashboard/studio/proposals?status=pending_approval&page_size=10': list(pendingItems),
    'GET /dashboard/studio/proposals?status=viewed&page_size=10': list([issuedView({ proposal: { id: 8, status: 'viewed', valid_until: '2099-01-01' } }).proposal]),
    'GET /dashboard/studio/proposals?status=issued&page_size=50': list([]),
    'GET /dashboard/studio/proposals?page_size=8': list([makeView().proposal]),
  })

  it('cards from /studio/summary (amounts as sent), “New proposal” for the Proposal Desk', async () => {
    studioBackend(routes())
    renderWith(<StudioHome />)
    await waitFor(() => expect(screen.getByTestId('stat-drafts')).toHaveTextContent('4'))
    expect(screen.getByTestId('stat-issued')).toHaveTextContent('₹6,04,395.00')
    expect(screen.getByTestId('stat-accepted')).toHaveTextContent('₹4,02,930.00')
    expect(screen.getByTestId('stat-win-rate')).toHaveTextContent('40%')
    expect(screen.getByTestId('new-proposal')).toHaveAttribute('href', '/dashboard/studio/new')
    expect(screen.queryByTestId('awaiting-my-approval')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('recent')).toHaveTextContent('Test Kumar Das'))
  })

  it('an approver sees “Awaiting your approval”; Management gets no “New proposal”', async () => {
    const backend = studioBackend(routes([makeView({ proposal: { id: 9, status: 'pending_approval' } }).proposal]))
    renderWith(<StudioHome />, ['management'])
    await waitFor(() => expect(screen.getByTestId('awaiting-my-approval')).toHaveTextContent('Test Kumar Das'))
    expect(screen.queryByTestId('new-proposal')).not.toBeInTheDocument()
    expect(backend.calls.some((c) => c.path.includes('status=pending_approval'))).toBe(true)
  })
})

describe('landing and guards per role', () => {
  it('the Proposal Desk alone lands on Studio Home', async () => {
    renderWith(<DashboardOverview />, ['proposal_desk'])
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/studio'))
  })

  it('the Proposal Desk with Sales keeps the Overview', async () => {
    studioBackend({})
    renderWith(<DashboardOverview />, ['sales', 'proposal_desk'])
    await new Promise((r) => setTimeout(r, 50))
    expect(replace).not.toHaveBeenCalledWith('/dashboard/studio')
  })

  it.each([
    [['proposal_desk'], true],
    [['proposal_desk', 'sales'], true],
    [['admin'], true],
    [['management'], true],
    [['sales'], false],
    [['accounts'], false],
  ])('%j → Studio page shown: %s', (roles, shown) => {
    render(asRoles(roles, <RequirePermission rule="studio.view" what="The Proposal Studio"><p>studio page</p></RequirePermission>))
    expect(!!screen.queryByText('studio page')).toBe(shown)
    if (!shown) expect(screen.getByTestId('no-access')).toBeInTheDocument()
  })

  it('approval review needs studio.approve: not the Proposal Desk', () => {
    render(asRoles(['proposal_desk'], <RequirePermission rule="studio.approve" what="Approving"><p>review</p></RequirePermission>))
    expect(screen.queryByText('review')).not.toBeInTheDocument()
  })
})
