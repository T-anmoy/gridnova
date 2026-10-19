import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadsPage from '@/app/(internal)/dashboard/leads/page'
import { navState } from './helpers/mock-navigation'
import type { LeadSummary } from '@/lib/dashboard/types'

const mockUseUser = vi.fn()
const mockUseAuth = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseAuth(),
}))

vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

const mockUseLeads = vi.fn()
vi.mock('@/lib/dashboard/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dashboard/api-client')>()),
  useLeads: (params: unknown) => mockUseLeads(params),
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  downloadLeadsCsv: vi.fn(),
}))

const paged = (items: LeadSummary[]) => ({ items, page: 1, page_size: 25, total: items.length })

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
  navState.reset('/dashboard/leads')
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
  mockUseAuth.mockReturnValue({ getToken: vi.fn() })
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('LeadsPage — Source column', () => {
  it('shows a distinct, labeled Source badge per lead, not lumped together', () => {
    mockUseLeads.mockReturnValue({ data: paged([CHAT_LEAD, BOOKING_LEAD]), isLoading: false, error: null, refetch: vi.fn() })
    render(<LeadsPage />)

    expect(screen.getByRole('columnheader', { name: 'Source' })).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Booking')).toBeInTheDocument()
  })

  it('filters by source on the server: the choice goes to the URL and the request, and resets to page 1', async () => {
    mockUseLeads.mockReturnValue({ data: paged([CHAT_LEAD, BOOKING_LEAD]), isLoading: false, error: null, refetch: vi.fn() })
    navState.reset('/dashboard/leads', 'page=3')
    const user = userEvent.setup()
    render(<LeadsPage />)

    // Assignment filter (admin sees this too, Prompt 03b), then Source — the
    // first two comboboxes in DOM order (the filter panel's score selects follow).
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1])
    await user.click(await screen.findByRole('option', { name: 'Booking' }))

    expect(navState.params.get('source')).toBe('website_booking')
    expect(navState.params.has('page')).toBe(false)
    expect(mockUseLeads).toHaveBeenLastCalledWith({ page: 1, page_size: 25, source: 'website_booking' })
  })
})
