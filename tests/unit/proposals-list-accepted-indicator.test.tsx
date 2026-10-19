import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProposalsPage from '@/app/(internal)/dashboard/proposals/page'
import type { ProposalSummary } from '@/lib/dashboard/types'

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { publicMetadata: { role: 'admin' } } }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('token') }),
}))

vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

const mockUseProposals = vi.fn()
vi.mock('@/lib/dashboard/api-client', () => ({
  useProposals: () => mockUseProposals(),
  downloadProposalsCsv: vi.fn(),
}))

const SENT_ACCEPTED: ProposalSummary = {
  id: 1, lead_id: 1, version: 1, status: 'sent', total_value: 100000, requires_manager_signoff: false,
  pdf_url: null, accepted_at: '2026-09-05T00:00:00Z', date_created: '2026-09-01T00:00:00Z', date_sent: '2026-09-02T00:00:00Z',
  lead: { id: 1, pipeline_stage: 'proposal_sent', lead_score: 'high' }, customer: { id: 1, name: 'Asha Roy', company: null, email: 'a@example.com' },
}
const SENT_UNACCEPTED: ProposalSummary = { ...SENT_ACCEPTED, id: 2, accepted_at: null }

beforeEach(() => vi.clearAllMocks())

describe('ProposalsPage — accepted indicator', () => {
  it('shows a distinct icon for accepted vs. awaiting-acceptance sent proposals, using the real accepted_at field', () => {
    mockUseProposals.mockReturnValue({ data: { items: [SENT_ACCEPTED, SENT_UNACCEPTED], page: 1, page_size: 50, total: 2 }, isLoading: false, error: null, refetch: vi.fn() })
    render(<ProposalsPage />)
    expect(screen.getByLabelText('Accepted')).toBeInTheDocument()
    expect(screen.getByLabelText('Awaiting acceptance')).toBeInTheDocument()
  })
})
