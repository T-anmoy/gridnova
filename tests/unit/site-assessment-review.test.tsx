import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SiteAssessmentsPage from '@/app/dashboard/site-assessments/page'
import SiteAssessmentDetailPage from '@/app/dashboard/site-assessments/[id]/page'
import type { ProposalInputDetail, ProposalInputSummary } from '@/lib/dashboard/types'
import { PROPOSAL_DRAFT_TRIGGERED, PROPOSAL_DRAFT_NOT_TRIGGERED, reviewProposalInputResponse } from './fixtures/dashboard-contract'

const mockUseUser = vi.fn()
const mockUseAuth = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseAuth(),
}))

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '7' }),
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}))

const mockUseProposalInputs = vi.fn()
const mockUseProposalInput = vi.fn()
const mockReviewMutation = vi.fn()
const mockFetchFileUrl = vi.fn()

vi.mock('@/lib/dashboard/api-client', () => ({
  useProposalInputs: (params: unknown) => mockUseProposalInputs(params),
  useProposalInput: (id: unknown) => mockUseProposalInput(id),
  useReviewProposalInput: () => ({ mutateAsync: mockReviewMutation, isPending: false }),
  fetchProposalInputFileUrl: (...args: unknown[]) => mockFetchFileUrl(...args),
}))

const SUMMARY: ProposalInputSummary = {
  id: 7,
  lead_id: 19,
  status: 'submitted',
  customer_type: 'individual',
  project_family: 'rooftop_solar',
  state: 'West Bengal',
  district: 'Hooghly',
  created_at: '2026-09-10T00:00:00Z',
}

const DETAIL: ProposalInputDetail = {
  ...SUMMARY,
  scheme_linked: false,
  scheme_name: null,
  pin_code: '712235',
  site_type: 'rooftop_residential',
  connection_type: 'on_grid',
  net_metering_required: true,
  dcr_panels_required: false,
  ev_charging: false,
  battery_storage: false,
  files: [
    { file_ref: 'abc123', target: 'document', filename: 'bill.pdf', document_type: 'electricity_bill' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue('token') })
})

describe('SiteAssessmentsPage — role visibility', () => {
  it("shows an honest 'no access' state for a role that isn't admin/sales, not an error toast", () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    mockUseProposalInputs.mockReturnValue({ data: { items: [SUMMARY], total: 1 }, isLoading: false, error: null, refetch: vi.fn() })
    render(<SiteAssessmentsPage />)
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('#7')).not.toBeInTheDocument()
  })

  it('lists submitted assessments for Sales', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    mockUseProposalInputs.mockReturnValue({ data: { items: [SUMMARY], total: 1 }, isLoading: false, error: null, refetch: vi.fn() })
    render(<SiteAssessmentsPage />)
    expect(screen.getByText('#7')).toBeInTheDocument()
  })
})

describe('SiteAssessmentDetailPage — review actions', () => {
  it('never shows gst_number or internal_notes labels when the backend omits them (Engineer view)', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposalInput.mockReturnValue({ data: DETAIL, isLoading: false, error: null, refetch: vi.fn() })
    render(<SiteAssessmentDetailPage />)
    expect(screen.queryByText('GST number')).not.toBeInTheDocument()
    expect(screen.queryByText('Internal notes')).not.toBeInTheDocument()
  })

  it('shows gst_number when the backend does include it', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposalInput.mockReturnValue({
      data: { ...DETAIL, gst_number: '19ABCDE1234F1Z5' },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    render(<SiteAssessmentDetailPage />)
    expect(screen.getByText('GST number')).toBeInTheDocument()
    expect(screen.getByText('19ABCDE1234F1Z5')).toBeInTheDocument()
  })

  it('fetches a fresh signed download URL on click and opens it, never caching it in the page', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposalInput.mockReturnValue({ data: DETAIL, isLoading: false, error: null, refetch: vi.fn() })
    mockFetchFileUrl.mockResolvedValue({ url: 'https://signed.example/bill.pdf', expires_at: '2026-09-10T01:00:00Z', filename: 'bill.pdf', file_ref: 'abc123', target: 'document' })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    render(<SiteAssessmentDetailPage />)

    await user.click(screen.getByRole('button', { name: /download/i }))
    await waitFor(() => {
      expect(mockFetchFileUrl).toHaveBeenCalledWith(7, 'abc123', 'token')
      expect(openSpy).toHaveBeenCalledWith('https://signed.example/bill.pdf', '_blank', 'noopener,noreferrer')
    })
  })

  it('requires a non-blank reason before Reject can be confirmed', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposalInput.mockReturnValue({ data: DETAIL, isLoading: false, error: null, refetch: vi.fn() })
    const user = userEvent.setup()
    render(<SiteAssessmentDetailPage />)

    await user.click(screen.getByRole('button', { name: /^reject$/i }))
    const confirmButton = screen.getByRole('button', { name: 'Reject' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText('Reason *'), 'Missing site photographs')
    expect(confirmButton).not.toBeDisabled()
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockReviewMutation).toHaveBeenCalledWith({ inputId: 7, status: 'rejected', rejectionReason: 'Missing site photographs' })
    })
  })

  it('shows a link to the created proposal after an approval that auto-drafted', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposalInput.mockReturnValue({ data: DETAIL, isLoading: false, error: null, refetch: vi.fn() })
    mockReviewMutation.mockResolvedValue(reviewProposalInputResponse({ proposal_draft: PROPOSAL_DRAFT_TRIGGERED }))
    const user = userEvent.setup()
    render(<SiteAssessmentDetailPage />)

    await user.click(screen.getByRole('button', { name: /approve for proposal/i }))
    expect(await screen.findByText(/view Proposal #501/i)).toBeInTheDocument()
  })

  it('shows the real missing_fields/reason honestly when approval did not auto-draft', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposalInput.mockReturnValue({ data: DETAIL, isLoading: false, error: null, refetch: vi.fn() })
    mockReviewMutation.mockResolvedValue(reviewProposalInputResponse({ proposal_draft: PROPOSAL_DRAFT_NOT_TRIGGERED }))
    const user = userEvent.setup()
    render(<SiteAssessmentDetailPage />)

    await user.click(screen.getByRole('button', { name: /approve for proposal/i }))
    expect(await screen.findByText(/Missing fields: capacity_kw/)).toBeInTheDocument()
    expect(screen.getByText('Lead is missing required fields')).toBeInTheDocument()
  })

  it('offers "Mark Under Review" on a submitted assessment', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposalInput.mockReturnValue({ data: DETAIL, isLoading: false, error: null, refetch: vi.fn() })
    mockReviewMutation.mockResolvedValue(reviewProposalInputResponse({ status: 'under_review' }))
    const user = userEvent.setup()
    render(<SiteAssessmentDetailPage />)

    await user.click(screen.getByRole('button', { name: /mark under review/i }))
    await waitFor(() => {
      expect(mockReviewMutation).toHaveBeenCalledWith({ inputId: 7, status: 'under_review' })
    })
  })
})
