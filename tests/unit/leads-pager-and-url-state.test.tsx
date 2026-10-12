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

describe('Leads date filter (IST)', () => {
  it('compares IST calendar days: 20:00 UTC on the 1st is already the 2nd in IST', () => {
    const late = leadItem(7, { created_at: '2026-09-01T20:00:00Z' }) // 2 Sep, 01:30 IST
    const early = leadItem(8, { created_at: '2026-09-01T10:00:00Z' }) // 1 Sep, 15:30 IST
    mockUseLeads.mockReturnValue({ data: leadPage([late, early]), isLoading: false, error: null, refetch: vi.fn(), isPlaceholderData: false })
    navState.reset('/dashboard/leads', 'from=2026-09-02&to=2026-09-02')
    render(<LeadsPage />)
    expect(screen.getByText('#7')).toBeInTheDocument()
    expect(screen.queryByText('#8')).not.toBeInTheDocument()
  })

  it('says the stage/score/date filters apply to the loaded page only', () => {
    navState.reset('/dashboard/leads', 'from=2026-09-01')
    render(<LeadsPage />)
    expect(screen.getByText(/apply to this page only/)).toBeInTheDocument()
  })
})

describe('Leads export', () => {
  it('sends the source filter (the only one the export endpoint accepts) and warns when others are active', async () => {
    navState.reset('/dashboard/leads', 'source=website_chat&q=ravi&stage=new')
    const user = userEvent.setup()
    render(<LeadsPage />)
    expect(screen.getByRole('note')).toHaveTextContent(/does not yet filter exports/)
    await user.click(screen.getByRole('button', { name: /Export CSV/ }))
    expect(mockDownload).toHaveBeenCalledWith({ source: 'website_chat' }, 'token')
  })

  it('shows no warning when only the source filter is active', () => {
    navState.reset('/dashboard/leads', 'source=website_chat')
    render(<LeadsPage />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})

describe('prefetchLeads key', () => {
  it('uses the same key the page builds, for Sales and for everyone else', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'prefetchQuery').mockResolvedValue(undefined)
    void prefetchLeads(qc, async () => 'token', defaultLeadListParams('sales'))
    expect(spy.mock.calls[0][0].queryKey).toEqual(['leads', { page: 1, page_size: 25, assigned: 'any' }])
    void prefetchLeads(qc, async () => 'token', defaultLeadListParams('admin'))
    expect(spy.mock.calls[1][0].queryKey).toEqual(['leads', { page: 1, page_size: 25 }])
  })
})
