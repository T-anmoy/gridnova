import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/dashboard/api-error'
import { surveyReviewError } from '@/lib/dashboard/survey-review-ui'
import { REVERIFICATION_REASON } from './fixtures/survey-review-contract'
import type { ProposalDetail } from '@/lib/dashboard/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const clear = vi.fn()
vi.mock('@/lib/dashboard/survey-review-api-client', () => ({ useClearReverification: () => ({ mutateAsync: clear, isPending: false }) }))

import { ReverificationBanner } from '@/components/dashboard/ReverificationBanner'

beforeEach(() => {
  vi.clearAllMocks()
  clear.mockResolvedValue({})
})

describe('ReverificationBanner', () => {
  it('lists the changed fields in words and the source', () => {
    render(<ReverificationBanner proposalId={31} reason={REVERIFICATION_REASON} role="admin" />)
    const b = screen.getByTestId('reverification-banner')
    expect(within(b).getByTestId('reverification-fields')).toHaveTextContent('roof area')
    expect(b).toHaveTextContent(/applied survey correction/)
    expect(b.textContent).not.toMatch(/roof_area_sqft/)
  })

  it.each(['admin', 'management', 'engineer'])('%s can clear it', (role) => {
    render(<ReverificationBanner proposalId={31} reason={REVERIFICATION_REASON} role={role} />)
    expect(screen.getByRole('button', { name: 'Clear re-verification' })).toBeInTheDocument()
  })

  it('sales and operations cannot', () => {
    for (const role of ['sales', 'operations']) {
      const { unmount } = render(<ReverificationBanner proposalId={31} reason={REVERIFICATION_REASON} role={role} />)
      expect(screen.queryByRole('button', { name: 'Clear re-verification' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('needs a note, then sends it', async () => {
    const user = userEvent.setup()
    render(<ReverificationBanner proposalId={31} reason={REVERIFICATION_REASON} role="engineer" />)
    await user.click(screen.getByRole('button', { name: 'Clear re-verification' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
    expect(within(dialog).getByLabelText('Note (required)')).toHaveAttribute('aria-invalid', 'true')
    expect(clear).not.toHaveBeenCalled()
    await user.type(within(dialog).getByLabelText('Note (required)'), 'Price rechecked')
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(clear).toHaveBeenCalledWith({ proposalId: 31, note: 'Price rechecked' }))
  })

  it('shows 403 segregation_of_duties plainly (the one who applied the correction cannot clear it)', async () => {
    clear.mockRejectedValue(new ApiError(403, 'x', 'x', { code: 'segregation_of_duties' }))
    const user = userEvent.setup()
    render(<ReverificationBanner proposalId={31} reason={REVERIFICATION_REASON} role="admin" />)
    await user.click(screen.getByRole('button', { name: 'Clear re-verification' }))
    await user.type(screen.getByLabelText('Note (required)'), 'ok')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear' }))
    expect(await screen.findByTestId('clear-error')).toHaveTextContent(/cannot decide a request you made or applied/)
  })
})

describe('surveyReviewError — object details never become [object Object]', () => {
  it('turns the 409 needs_reverification object into a sentence naming the fields', () => {
    const msg = surveyReviewError(new ApiError(409, 'x', 'The proposal must be re-verified.', { code: 'needs_reverification', message: 'The proposal must be re-verified.', fields: ['roof_area_sqft', 'sanctioned_load_kw'] }))
    expect(msg).toContain('roof area, sanctioned load')
    expect(msg).not.toMatch(/object/i)
  })
  it('maps the formal-proposal gate codes', () => {
    expect(surveyReviewError(new ApiError(409, 'x', 'x', { code: 'survey_not_feasible' }))).toMatch(/not feasible/)
    expect(surveyReviewError(new ApiError(409, 'x', 'x', { code: 'survey_review_required', review_outcome: null, revised_after_review: false }))).toMatch(/review is required/)
  })
  it('falls back to the server message, then to the caller fallback', () => {
    expect(surveyReviewError(new ApiError(400, 'x', 'Plain server text'))).toBe('Plain server text')
    expect(surveyReviewError(new ApiError(500, 'x', ''), 'Fallback')).toBe('Fallback')
  })
})

// ── Proposal detail page ─────────────────────────────────────────────────

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useUser: () => mockUseUser(), useAuth: () => ({ getToken: vi.fn().mockResolvedValue('t') }) }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '501' }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))
const mockUseProposal = vi.fn()
const mockSend = vi.fn()
vi.mock('@/lib/dashboard/api-client', () => ({
  useProposal: () => mockUseProposal(),
  useProposalPdf: () => ({ data: undefined }),
  useApproveProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useManagerSignOff: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRequestRevision: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendProposal: () => ({ mutateAsync: mockSend, isPending: false }),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdjustPricing: () => ({ mutateAsync: vi.fn(), isPending: false }),
  fetchProposalPdf: vi.fn(),
}))

import ProposalDetailPage from '@/app/(internal)/dashboard/proposals/[id]/page'
import { toast } from 'sonner'

const PROPOSAL: ProposalDetail = {
  id: 501, lead_id: 19, version: 1, status: 'approved', content: {}, total_value: 250000, requires_manager_signoff: false, revision_reason: null,
  pdf_url: null, pdf_available: true, date_created: null, date_sent: null,
  customer: { id: 1, name: 'Asha Roy', company: null, email: 'a@example.com' }, lead: { id: 19, pipeline_stage: 'proposal_sent', lead_score: 'high' }, versions: [],
  needs_reverification: true, reverification_reason: REVERIFICATION_REASON,
}

describe('ProposalDetailPage — flagged for re-verification', () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseProposal.mockReturnValue({ data: PROPOSAL, isLoading: false, error: null, refetch: vi.fn() })
  })

  it('shows the banner and disables Send with the reason, so a send cannot be attempted', () => {
    render(<ProposalDetailPage />)
    expect(screen.getByTestId('reverification-banner')).toBeInTheDocument()
    expect(screen.getByTestId('send-blocked-reverification')).toBeDisabled()
  })

  it('an engineer (no action buttons) still sees the banner and can clear it', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    render(<ProposalDetailPage />)
    expect(screen.getByRole('button', { name: 'Clear re-verification' })).toBeInTheDocument()
    expect(screen.queryByTestId('send-blocked-reverification')).not.toBeInTheDocument()
  })

  it('an unflagged proposal sends as before', () => {
    mockUseProposal.mockReturnValue({ data: { ...PROPOSAL, needs_reverification: false, reverification_reason: null }, isLoading: false, error: null, refetch: vi.fn() })
    render(<ProposalDetailPage />)
    expect(screen.queryByTestId('reverification-banner')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send to Customer/ })).toBeEnabled()
  })

  it('a send that still gets the 409 object detail toasts a sentence, never [object Object]', async () => {
    mockUseProposal.mockReturnValue({ data: { ...PROPOSAL, needs_reverification: false, reverification_reason: null }, isLoading: false, error: null, refetch: vi.fn() })
    mockSend.mockRejectedValue(new ApiError(409, 'x', 'must be re-verified', { code: 'needs_reverification', message: 'must be re-verified', fields: ['roof_area_sqft'] }))
    const user = userEvent.setup()
    render(<ProposalDetailPage />)
    await user.click(screen.getByRole('button', { name: /Send to Customer/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled())
    const text = String(vi.mocked(toast.error).mock.calls[0][0])
    expect(text).toContain('roof area')
    expect(text).not.toMatch(/object Object/)
  })
})
