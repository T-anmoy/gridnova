import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadsPage from '@/app/(internal)/dashboard/leads/page'
import { navState } from './helpers/mock-navigation'
import { LEAD_LIST_FIXTURE, leadItem, leadPage } from './fixtures/leads-contract'
import { leadListResponseSchema } from '@/lib/dashboard/schemas'
import { defaultLeadListParams, prefetchLeads } from '@/lib/dashboard/api-client'
import { QueryClient } from '@tanstack/react-query'

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('token') }),
}))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

const mockUseLeads = vi.fn()
const mockDownload = vi.fn()
vi.mock('@/lib/dashboard/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dashboard/api-client')>()),
  useLeads: (params: unknown) => mockUseLeads(params),
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  downloadLeadsCsv: (...args: unknown[]) => mockDownload(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  navState.reset('/dashboard/leads')
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
  mockUseLeads.mockReturnValue({ data: LEAD_LIST_FIXTURE, isLoading: false, error: null, refetch: vi.fn(), isPlaceholderData: false })
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.useRealTimers())

describe('leads list envelope contract (BE-1 §2)', () => {
  it('the shared fixture satisfies the schema, and a bare array no longer does', () => {
    expect(leadListResponseSchema.safeParse(LEAD_LIST_FIXTURE).success).toBe(true)
    expect(leadListResponseSchema.safeParse([leadItem(1)]).success).toBe(false)
  })
})

describe('Leads pager', () => {
  it('shows the page, total and a Next button that moves to page 2 through the URL', async () => {
    mockUseLeads.mockReturnValue({ data: leadPage([leadItem(1)], { page: 1, total: 60 }), isLoading: false, error: null, refetch: vi.fn(), isPlaceholderData: false })
    const user = userEvent.setup()
    render(<LeadsPage />)
    expect(screen.getByText(/Page 1 of 3 · 60 leads/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(navState.params.get('page')).toBe('2')
    expect(mockUseLeads).toHaveBeenLastCalledWith({ page: 2, page_size: 25 })
  })

  it('restores the page and filters from the URL', () => {
    navState.reset('/dashboard/leads', 'page=2&source=website_chat&q=ravi&assigned=unassigned')
    render(<LeadsPage />)
    expect(mockUseLeads).toHaveBeenLastCalledWith({ page: 2, page_size: 25, source: 'website_chat', q: 'ravi', assigned: 'unassigned' })
  })

  it('debounces the search by 300 ms, writes q to the URL and resets to page 1', () => {
    vi.useFakeTimers()
    navState.reset('/dashboard/leads', 'page=4')
    render(<LeadsPage />)
    const box = screen.getByRole('searchbox')
    fireEvent.change(box, { target: { value: 'ravi' } })
    act(() => void vi.advanceTimersByTime(299))
    expect(navState.params.has('q')).toBe(false)
    act(() => void vi.advanceTimersByTime(2))
    expect(navState.params.get('q')).toBe('ravi')
    expect(navState.params.has('page')).toBe(false)
    expect(mockUseLeads).toHaveBeenLastCalledWith({ page: 1, page_size: 25, q: 'ravi' })
  })

  it('Clear filters removes everything from the URL', async () => {
    navState.reset('/dashboard/leads', 'page=2&source=website_chat&q=ravi')
    const user = userEvent.setup()
    render(<LeadsPage />)
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(navState.search).toBe('')
  })
})

describe('Leads filters go to the server (staff_contracts.md §3)', () => {
  it('sends stage (as a list), score range and IST dates from the URL to the request', () => {
    navState.reset('/dashboard/leads', 'stage=new&stage=won&min_score=low&max_score=high&created_from=2026-09-01&created_to=2026-09-03')
    render(<LeadsPage />)
    expect(mockUseLeads).toHaveBeenLastCalledWith({
      page: 1, page_size: 25, stage: ['new', 'won'], min_score: 'low', max_score: 'high',
      created_from: '2026-09-01', created_to: '2026-09-03',
    })
  })

  it('does not filter the loaded rows on the client: every row the server returned is shown', () => {
    const late = leadItem(7, { created_at: '2026-09-01T20:00:00Z', pipeline_stage: 'new' })
    const other = leadItem(8, { created_at: '2026-09-01T10:00:00Z', pipeline_stage: 'won' })
    mockUseLeads.mockReturnValue({ data: leadPage([late, other]), isLoading: false, error: null, refetch: vi.fn(), isPlaceholderData: false })
    navState.reset('/dashboard/leads', 'stage=new&created_from=2026-09-02')
    render(<LeadsPage />)
    expect(screen.getByText('#7')).toBeInTheDocument()
    expect(screen.getByText('#8')).toBeInTheDocument()
  })

  it('no longer says filters apply to the loaded page only', () => {
    navState.reset('/dashboard/leads', 'created_from=2026-09-01')
    render(<LeadsPage />)
    expect(screen.queryByText(/apply to this page only/)).not.toBeInTheDocument()
  })
})

describe('Leads export', () => {
  it('sends the same server filters and source, and notes that search and assignment are not applied', async () => {
    navState.reset('/dashboard/leads', 'source=website_chat&q=ravi&stage=new&min_score=medium&created_to=2026-09-03')
    const user = userEvent.setup()
    render(<LeadsPage />)
    expect(screen.getByRole('note')).toHaveTextContent(/Search and assignment are not applied/)
    await user.click(screen.getByRole('button', { name: /Export CSV/ }))
    expect(mockDownload).toHaveBeenCalledWith(
      { stage: ['new'], min_score: 'medium', created_to: '2026-09-03', source: 'website_chat' },
      'token',
    )
  })

  it('shows no note when search and assignment are not set', () => {
    navState.reset('/dashboard/leads', 'source=website_chat&stage=new')
    render(<LeadsPage />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})

describe('prefetchLeads key', () => {
  it('uses the same key the page builds, for Sales and for everyone else', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'prefetchQuery').mockResolvedValue(undefined)
    void prefetchLeads(qc, async () => 'token', defaultLeadListParams(true))
    expect(spy.mock.calls[0][0].queryKey).toEqual(['leads', { page: 1, page_size: 25, assigned: 'any' }])
    void prefetchLeads(qc, async () => 'token', defaultLeadListParams(false))
    expect(spy.mock.calls[1][0].queryKey).toEqual(['leads', { page: 1, page_size: 25 }])
  })
})
