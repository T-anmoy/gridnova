import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalDetailPage from '@/app/(internal)/dashboard/proposals/[id]/page'
import { NAV_ITEMS, canSeeNavItem } from '@/lib/dashboard/nav'
import type { ProposalDetail } from '@/lib/dashboard/types'
import type { DocumentView } from '@/lib/proposals/document-types'
import { NO_DOCUMENT_VIEW, docError, documentView, technicalView } from './fixtures/proposal-document-contract'

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }))

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => ({ getToken: () => Promise.resolve('token') }),
}))
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '12' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: mockBack, forward: vi.fn(), prefetch: vi.fn() }),
}))

const mockUseProposal = vi.fn()
const mockApprove = vi.fn()
const mockSignOff = vi.fn()
const mockSend = vi.fn()
const mockAdjust = vi.fn()
vi.mock('@/lib/dashboard/api-client', () => ({
  useProposal: () => mockUseProposal(),
  useProposalPdf: () => ({ data: undefined }),
  useApproveProposal: () => ({ mutateAsync: mockApprove, isPending: false }),
  useManagerSignOff: () => ({ mutateAsync: mockSignOff, isPending: false }),
  useRequestRevision: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendProposal: () => ({ mutateAsync: mockSend, isPending: false }),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdjustPricing: () => ({ mutateAsync: mockAdjust, isPending: false }),
  useEquipment: () => ({ data: [], isError: false }),
  fetchProposalPdf: vi.fn(),
}))

let mockView: DocumentView
vi.mock('@/lib/proposals/document-api-client', () => ({
  useProposalDocument: () => ({ data: mockView, isLoading: false, error: null, refetch: vi.fn() }),
  useEditDocumentSection: () => ({ mutateAsync: vi.fn(), isPending: false }),
  fetchPreviewPdf: vi.fn().mockResolvedValue(new Blob(['%PDF'])),
}))

function proposal(over: Partial<ProposalDetail> = {}): ProposalDetail {
  return {
    id: 12,
    lead_id: 19,
    version: 1,
    status: 'draft',
    content: { document: {} },
    total_value: 201465,
    requires_manager_signoff: false,
    revision_reason: null,
    pdf_url: null,
    pdf_available: false,
    date_created: '2026-10-23T00:00:00Z',
    date_sent: null,
    customer: { id: 1, name: 'Asha Roy', company: null, email: 'asha@example.com' },
    lead: { id: 19, pipeline_stage: 'proposal_sent', lead_score: 'high' },
    versions: [],
    document: mockView,
    ...over,
  } as ProposalDetail
}

const as = (role: string) => mockUseUser.mockReturnValue({ user: { publicMetadata: { role } } })
const show = (p: ProposalDetail) => mockUseProposal.mockReturnValue({ data: p, isLoading: false, error: null, refetch: vi.fn() })

beforeEach(() => {
  vi.clearAllMocks()
  mockView = documentView({ missing_required: [] })
  as('admin')
})

describe('approve checklist', () => {
  it('Approve is disabled, with the missing list, while anything required is missing', () => {
    mockView = documentView()
    show(proposal())
    render(<ProposalDetailPage />)
    expect(screen.getByTestId('approve-button')).toBeDisabled()
    expect(screen.getByTestId('approve-blocked-hint')).toBeInTheDocument()
    expect(within(screen.getByTestId('missing-required')).getByRole('button', { name: 'The DISCOM' })).toBeInTheDocument()
  })

  it('shows required fields, tier, price mode and the preview link; confirm approves', async () => {
    show(proposal())
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.click(screen.getByTestId('approve-button'))
    const list = screen.getByTestId('approve-checklist')
    expect(list).toHaveTextContent('All required details are filled in')
    expect(list).toHaveTextContent('standard approval (Admin or Sales)')
    expect(list).toHaveTextContent('From the price list — ₹2,01,465.00 incl. GST')
    expect(within(list).getByRole('button', { name: 'Go to the preview' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(mockApprove).toHaveBeenCalledWith(12)
  })

  it('a 409 missing_required on approve lists the missing fields as links', async () => {
    mockApprove.mockRejectedValue(docError(409, { code: 'missing_required', message: 'This proposal cannot be approved or sent yet', missing: [{ field: 'site.town', message: 'the town' }] }))
    show(proposal())
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.click(screen.getByTestId('approve-button'))
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await within(screen.getByTestId('missing-required')).findByRole('button', { name: 'The town' })).toBeInTheDocument()
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/required details are still missing/))
  })

  it('manager sign-off: Management and Admin get the checklist; Sales does not', async () => {
    show(proposal({ requires_manager_signoff: true, status: 'pending_approval' }))
    as('management')
    const { unmount } = render(<ProposalDetailPage />)
    expect(screen.getByTestId('signoff-button')).toBeEnabled()
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument()
    unmount()
    as('sales')
    render(<ProposalDetailPage />)
    expect(screen.queryByTestId('signoff-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument()
  })
})

describe('after approval and sending', () => {
  it('approved: reference and date in the header, locked banner with Request revision for Admin / Sales only', () => {
    mockView = documentView({ status: 'approved', locked: true, editable_sections: [], missing_required: [], document_reference: 'GN/23/10/2026/01', document_date: '2026-10-23' })
    show(proposal({ status: 'approved' }))
    const { unmount } = render(<ProposalDetailPage />)
    expect(screen.getByTestId('header-reference')).toHaveTextContent('GN/23/10/2026/01')
    expect(within(screen.getByTestId('locked-banner')).getByRole('button', { name: /Request Revision/ })).toBeInTheDocument()
    unmount()
    as('management')
    render(<ProposalDetailPage />)
    expect(screen.getByTestId('locked-banner')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Request Revision/ })).not.toBeInTheDocument()
  })

  it('sent: reference, date and the customer link', () => {
    mockView = documentView({ status: 'sent', locked: true, editable_sections: [], missing_required: [], document_reference: 'GN/23/10/2026/01', document_date: '2026-10-23' })
    show(proposal({ status: 'sent', accept_url: 'https://gridnova.in/proposal/accept/tok', pdf_available: true }))
    render(<ProposalDetailPage />)
    expect(screen.getByTestId('sent-reference')).toHaveTextContent('Reference GN/23/10/2026/01')
    expect(screen.getByRole('link', { name: 'https://gridnova.in/proposal/accept/tok' })).toBeInTheDocument()
  })

  it('send 409 missing_required lists the fields', async () => {
    mockView = documentView({ status: 'approved', locked: true, editable_sections: [], missing_required: [], document_reference: 'GN/23/10/2026/01' })
    mockSend.mockRejectedValue(docError(409, { code: 'missing_required', message: 'x', missing: [{ field: 'connection.consumer_number', message: 'the consumer number' }] }))
    show(proposal({ status: 'approved' }))
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.click(screen.getByRole('button', { name: /Send to Customer/ }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/required details are still missing/)))
  })
})

describe('roles', () => {
  it('Management never sees Request Revision (Admin / Sales only in the backend)', () => {
    show(proposal())
    as('management')
    render(<ProposalDetailPage />)
    expect(screen.queryByRole('button', { name: /Request Revision/ })).not.toBeInTheDocument()
  })

  it('Engineer: no price in the header, no preview, the technical note', () => {
    mockView = technicalView()
    show(proposal({ total_value: null, content: null, customer: null }))
    as('engineer')
    render(<ProposalDetailPage />)
    expect(screen.getByTestId('technical-note')).toBeInTheDocument()
    expect(screen.queryByTestId('proposal-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('header-reference')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/₹/)
  })

  it('Accounts and Operations have no proposals in the navigation', () => {
    const item = NAV_ITEMS.find((i) => i.href === '/dashboard/proposals')!
    expect(canSeeNavItem(item, 'accounts')).toBe(false)
    expect(canSeeNavItem(item, 'operations')).toBe(false)
    for (const r of ['admin', 'sales', 'management', 'engineer'] as const) expect(canSeeNavItem(item, r)).toBe(true)
  })
})

describe('older proposal', () => {
  it('has_document false: the plain note, no editor, the old content still shown', () => {
    mockView = NO_DOCUMENT_VIEW
    show(proposal({ document: NO_DOCUMENT_VIEW, content: { scope_of_work: 'Install rooftop system' } }))
    render(<ProposalDetailPage />)
    expect(screen.getByTestId('no-document-note')).toBeInTheDocument()
    expect(screen.queryByTestId('proposal-document-editor')).not.toBeInTheDocument()
    expect(screen.getByText('Install rooftop system')).toBeInTheDocument()
  })
})

describe('adjust pricing — one input at a time', () => {
  it('a documented proposal offers total, basic or rate per kWp and sends only the chosen one', async () => {
    mockAdjust.mockResolvedValue({ status: 'pricing_adjusted', proposal_id: 12, total_value: 201465, requires_manager_signoff: false, reason: 'r' })
    show(proposal())
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.click(screen.getAllByRole('button', { name: /Adjust Price/ })[0])
    await user.click(screen.getByRole('radio', { name: 'Basic price (before GST)' }))
    await user.type(screen.getByLabelText(/Basic price before GST/), '185000')
    await user.type(screen.getByLabelText(/Reason/), 'Matched competitor')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mockAdjust).toHaveBeenCalledWith({ proposalId: 12, basicPrice: '185000', reason: 'Matched competitor' })
  })

  it('an older proposal only offers the total', async () => {
    mockView = NO_DOCUMENT_VIEW
    show(proposal({ document: NO_DOCUMENT_VIEW }))
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.click(screen.getByRole('button', { name: /Adjust Price/ }))
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/New total value/)).toBeInTheDocument()
  })
})

describe('unsaved changes guard', () => {
  it('Back asks first while a section has unsaved typing', async () => {
    show(proposal())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.type(screen.getByLabelText('DISCOM'), 'W')
    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(confirm).toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(mockBack).toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('an in-app link asks first; cancelling stays on the page', async () => {
    show(proposal())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(
      <>
        {/* A plain anchor on purpose: the guard listens for any in-app link click. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/dashboard/leads">Leads</a>
        <ProposalDetailPage />
      </>,
    )
    await user.type(screen.getByLabelText('DISCOM'), 'W')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    screen.getByRole('link', { name: 'Leads' }).dispatchEvent(click)
    expect(confirm).toHaveBeenCalled()
    expect(click.defaultPrevented).toBe(true)
    confirm.mockRestore()
  })
})
