import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalDetailPage from '@/app/(internal)/dashboard/proposals/[id]/page'
import { ApiError } from '@/lib/dashboard/api-error'
import type { ProposalDetail } from '@/lib/dashboard/types'

const toastErrorSpy = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...args: unknown[]) => toastErrorSpy(...args) } }))

const mockUseUser = vi.fn()
const mockGetToken = vi.fn().mockResolvedValue('token')
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => ({ getToken: mockGetToken }),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '501' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}))

const mockUseProposal = vi.fn()
const mockUseProposalPdf = vi.fn()
const mockApprove = vi.fn()
const mockManagerSignOff = vi.fn()
const mockRequestRevision = vi.fn()
const mockSend = vi.fn()
const mockDraft = vi.fn()
const mockAdjustPricing = vi.fn()
const mockFetchProposalPdf = vi.fn()

// FE-13: the page also reads the BE-13 document; these proposals have none.
vi.mock('@/lib/proposals/document-api-client', () => ({
  useProposalDocument: () => ({ data: undefined, isLoading: false, error: null, refetch: () => {} }),
  useEditDocumentSection: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }),
  fetchPreviewPdf: () => Promise.reject(new Error('not used')),
}))
vi.mock('@/lib/dashboard/api-client', () => ({
  useProposal: () => mockUseProposal(),
  useProposalPdf: () => mockUseProposalPdf(),
  useApproveProposal: () => ({ mutateAsync: mockApprove, isPending: false }),
  useManagerSignOff: () => ({ mutateAsync: mockManagerSignOff, isPending: false }),
  useRequestRevision: () => ({ mutateAsync: mockRequestRevision, isPending: false }),
  useSendProposal: () => ({ mutateAsync: mockSend, isPending: false }),
  useDraftProposal: () => ({ mutateAsync: mockDraft, isPending: false }),
  useAdjustPricing: () => ({ mutateAsync: mockAdjustPricing, isPending: false }),
  fetchProposalPdf: (...args: unknown[]) => mockFetchProposalPdf(...args),
}))

const BASE_PROPOSAL: ProposalDetail = {
  id: 501,
  lead_id: 19,
  version: 1,
  status: 'approved',
  content: { scope_of_work: 'Install rooftop system' },
  total_value: 250000,
  requires_manager_signoff: false,
  revision_reason: null,
  pdf_url: 'https://raw-storage.example/private/501.pdf',
  pdf_available: true,
  date_created: '2026-09-01T00:00:00Z',
  date_sent: null,
  customer: { id: 1, name: 'Asha Roy', company: null, email: 'asha@example.com' },
  lead: { id: 19, pipeline_stage: 'proposal_sent', lead_score: 'high' },
  versions: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetToken.mockResolvedValue('token')
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
  mockUseProposalPdf.mockReturnValue({ data: undefined })
})

describe('ProposalDetailPage — placeholder content banner', () => {
  it('shows the banner with real section labels and disables Send with a tooltip explaining why', async () => {
    mockUseProposal.mockReturnValue({
      data: { ...BASE_PROPOSAL, has_placeholder_content: true, placeholder_sections: ['scope_of_work', 'warranty_support'] },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    const user = userEvent.setup()
    render(<ProposalDetailPage />)

    expect(screen.getByText('This proposal still has placeholder content')).toBeInTheDocument()
    expect(screen.getByText('Sections: Scope Of Work, Warranty Support')).toBeInTheDocument()

    const sendButton = screen.getByRole('button', { name: /send to customer/i })
    expect(sendButton).toBeDisabled()
    await user.hover(sendButton)
    expect(await screen.findByText(/still has placeholder content: Scope Of Work, Warranty Support/i)).toBeInTheDocument()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('never renders "[object Object]" when the 409 still happens despite the disabled control', async () => {
    mockUseProposal.mockReturnValue({ data: BASE_PROPOSAL, isLoading: false, error: null, refetch: vi.fn() })
    mockSend.mockRejectedValue(
      new ApiError(409, 'API error 409', 'This proposal still has placeholder content', {
        code: 'placeholder_content',
        message: 'This proposal still has placeholder content',
        placeholder_sections: ['terms_conditions'],
        missing_total_value: false,
      })
    )
    const user = userEvent.setup()
    render(<ProposalDetailPage />)

    await user.click(screen.getByRole('button', { name: /send to customer/i }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText('This proposal still has placeholder content')).toBeInTheDocument()
    })
    expect(document.body.textContent).not.toContain('[object Object]')
  })

  // BE-22: Grid Nova's wording an Admin has not approved, and the generic-scope fallback.
  it('explains unapproved wording and points to the Launch readiness', async () => {
    mockUseProposal.mockReturnValue({ data: BASE_PROPOSAL, isLoading: false, error: null, refetch: vi.fn() })
    mockSend.mockRejectedValue(
      new ApiError(409, 'API error 409', 'x', {
        code: 'unapproved_sections',
        message: 'This proposal cannot be sent to a customer yet: wording not yet approved by an Admin in section(s): terms_conditions.',
        placeholder_sections: [],
        unapproved_sections: ['terms_conditions'],
        manual_review_required: false,
        missing_total_value: false,
      })
    )
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.click(screen.getByRole('button', { name: /send to customer/i }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    const banner = await screen.findByTestId('send-hold-banner')
    expect(within(banner).getByTestId('hold-unapproved')).toHaveTextContent('Sections: Terms Conditions.')
    expect(within(banner).getByRole('link', { name: 'Launch readiness' })).toHaveAttribute('href', '/dashboard/data-checklist')
    expect(banner).not.toHaveTextContent('placeholder content')
    expect(within(banner).queryByTestId('hold-manual-review')).toBeNull()
  })

  it('explains the generic-scope manual review and a missing price', async () => {
    mockUseProposal.mockReturnValue({ data: { ...BASE_PROPOSAL, total_value: null }, isLoading: false, error: null, refetch: vi.fn() })
    mockSend.mockRejectedValue(
      new ApiError(409, 'API error 409', 'x', {
        code: 'placeholder_content',
        message: 'x',
        placeholder_sections: [],
        unapproved_sections: [],
        manual_review_required: true,
        missing_total_value: true,
      })
    )
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    expect(screen.getByTestId('price-to-be-set')).toHaveTextContent('Price to be set by Grid Nova')
    expect(document.body.textContent).not.toContain('₹0')
    await user.click(screen.getByRole('button', { name: /send to customer/i }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    const banner = await screen.findByTestId('send-hold-banner')
    expect(within(banner).getByTestId('hold-no-price')).toHaveTextContent('Price to be set by Grid Nova')
    expect(within(banner).getByTestId('hold-manual-review')).toHaveTextContent('generic one was used')
  })
})

describe('ProposalDetailPage — adjust pricing', () => {
  it('requires both a new value and a reason, and reports whether manager sign-off is now required', async () => {
    mockUseProposal.mockReturnValue({ data: { ...BASE_PROPOSAL, status: 'draft' }, isLoading: false, error: null, refetch: vi.fn() })
    mockAdjustPricing.mockResolvedValue({ status: 'pricing_adjusted', proposal_id: 501, total_value: 300000, requires_manager_signoff: true, reason: 'Equipment cost increased' })
    const user = userEvent.setup()
    render(<ProposalDetailPage />)

    await user.click(screen.getByRole('button', { name: /adjust price/i }))
    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()

    await user.type(screen.getByLabelText(/new total value/i), '300000')
    expect(saveButton).toBeDisabled()
    await user.type(screen.getByLabelText(/reason/i), 'Equipment cost increased')
    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)
    await waitFor(() => {
      expect(mockAdjustPricing).toHaveBeenCalledWith({ proposalId: 501, newValue: 300000, reason: 'Equipment cost increased' })
    })
  })

  it('is visible for Sales (can_adjust_pricing) but hidden for Management, who cannot adjust pricing', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    mockUseProposal.mockReturnValue({ data: { ...BASE_PROPOSAL, status: 'draft' }, isLoading: false, error: null, refetch: vi.fn() })
    const { unmount } = render(<ProposalDetailPage />)
    expect(screen.getByRole('button', { name: /adjust price/i })).toBeInTheDocument()
    unmount()

    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'management' } } })
    render(<ProposalDetailPage />)
    expect(screen.queryByRole('button', { name: /adjust price/i })).not.toBeInTheDocument()
  })

  it('surfaces the real backend 403 text verbatim (role or assignment)', async () => {
    mockUseProposal.mockReturnValue({ data: { ...BASE_PROPOSAL, status: 'draft' }, isLoading: false, error: null, refetch: vi.fn() })
    mockAdjustPricing.mockRejectedValue(new ApiError(403, 'API error 403', 'This proposal is not assigned to you.'))
    const user = userEvent.setup()
    render(<ProposalDetailPage />)

    await user.click(screen.getByRole('button', { name: /adjust price/i }))
    await user.type(screen.getByLabelText(/new total value/i), '300000')
    await user.type(screen.getByLabelText(/reason/i), 'Equipment cost increased')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith('This proposal is not assigned to you.')
    })
  })
})

describe('ProposalDetailPage — send result / accept link', () => {
  it('shows a persistent notice and copy-to-clipboard when the customer email was skipped', async () => {
    mockUseProposal.mockReturnValue({ data: BASE_PROPOSAL, isLoading: false, error: null, refetch: vi.fn() })
    mockSend.mockResolvedValue({ status: 'sent', proposal_id: 501, customer_email_sent: false, customer_email_skipped_reason: 'no_customer_email' })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    const user = userEvent.setup()
    render(<ProposalDetailPage />)

    await user.click(screen.getByRole('button', { name: /send to customer/i }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText(/customer confirmation email was not/i)).toBeInTheDocument()
    expect(screen.getByText('The customer has no email address on file.')).toBeInTheDocument()
  })

  it('fetches the PDF fresh on click for a sent proposal, never on page load', async () => {
    mockUseProposal.mockReturnValue({ data: { ...BASE_PROPOSAL, status: 'sent', accepted_at: null }, isLoading: false, error: null, refetch: vi.fn() })
    mockFetchProposalPdf.mockResolvedValue({ pdf_url: 'https://signed.example/501.pdf', proposal_id: 501, expires_at: '2026-09-10T00:00:00Z' })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    render(<ProposalDetailPage />)

    expect(mockFetchProposalPdf).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /download pdf/i }))
    await waitFor(() => {
      expect(mockFetchProposalPdf).toHaveBeenCalledWith(501, 'token')
      expect(openSpy).toHaveBeenCalledWith('https://signed.example/501.pdf', '_blank', 'noopener,noreferrer')
    })
  })
})
