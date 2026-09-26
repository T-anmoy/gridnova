import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadsPage from '@/app/(internal)/dashboard/leads/page'
import type { LeadSummary } from '@/lib/dashboard/types'

const mockUseUser = vi.fn()
const mockUseAuth = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseAuth(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}))

const mockUseLeads = vi.fn()
vi.mock('@/lib/dashboard/api-client', () => ({
  useLeads: () => mockUseLeads(),
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  downloadLeadsCsv: vi.fn(),
}))

const CHAT_LEAD: LeadSummary = {
  id: 1,
  customer_id: 1,
  customer_name: 'Asha Roy',
  pipeline_stage: 'new',
  lead_score: 'high',
  source: 'website_chat',
  created_at: '2026-09-01T00:00:00Z',
}
const BOOKING_LEAD: LeadSummary = {
  ...CHAT_LEAD,
  id: 2,
  customer_name: 'Rohit Sen',
  source: 'website_booking',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
  mockUseAuth.mockReturnValue({ getToken: vi.fn() })
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('LeadsPage — Source column', () => {
  it('shows a distinct, labeled Source badge per lead, not lumped together', () => {
    mockUseLeads.mockReturnValue({ data: [CHAT_LEAD, BOOKING_LEAD], isLoading: false, error: null, refetch: vi.fn() })
    render(<LeadsPage />)

    expect(screen.getByRole('columnheader', { name: 'Source' })).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Booking')).toBeInTheDocument()
  })

  it('filters the table by source', async () => {
    mockUseLeads.mockReturnValue({ data: [CHAT_LEAD, BOOKING_LEAD], isLoading: false, error: null, refetch: vi.fn() })
    const user = userEvent.setup()
    render(<LeadsPage />)

    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()

    // Assignment filter (admin sees this too, Prompt 03b), Stage, Score,
    // then Source — the filter comboboxes in DOM order (none but the
    // assignment one carry an accessible name).
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[3])
    await user.click(await screen.findByRole('option', { name: 'Booking' }))

    expect(screen.queryByText('#1')).not.toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })
})
