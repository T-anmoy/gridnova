import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MeetingsPage from '@/app/dashboard/meetings/page'
import type { MeetingSummary } from '@/lib/dashboard/types'

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useUser: () => mockUseUser() }))

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}))

const mockUseMeetings = vi.fn()
vi.mock('@/lib/dashboard/api-client', () => ({
  useMeetings: (params: unknown) => mockUseMeetings(params),
}))

const MEETING: MeetingSummary = {
  id: 1,
  lead_id: 42,
  employee_id: 'emp-1',
  employee_name: 'Arun Kumar',
  customer: { id: 5, name: 'Asha Roy', email: 'asha@example.com', phone: '+919876543210' },
  scheduled_at: '2026-09-10T08:30:00Z',
  duration_minutes: 30,
  status: 'scheduled',
  meet_link: 'https://meet.google.com/abc-defg-hij',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
})

describe('MeetingsPage', () => {
  it('renders real meeting data — customer, formatted date/time, and status', () => {
    mockUseMeetings.mockReturnValue({
      data: { items: [MEETING], page: 1, page_size: 50, total: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<MeetingsPage />)

    expect(screen.getByText('Asha Roy')).toBeInTheDocument()
    expect(screen.getByText('scheduled')).toBeInTheDocument()
    expect(screen.getByText('1 total meetings')).toBeInTheDocument()
    // Real IST-formatted date/time, not the raw ISO string.
    expect(screen.queryByText('2026-09-10T08:30:00Z')).not.toBeInTheDocument()
  })

  it('links through to the associated lead — clicking the row or its lead reference navigates there', async () => {
    mockUseMeetings.mockReturnValue({
      data: { items: [MEETING], page: 1, page_size: 50, total: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    const user = userEvent.setup()
    render(<MeetingsPage />)

    await user.click(screen.getByRole('button', { name: '#42' }))
    expect(pushMock).toHaveBeenCalledWith('/dashboard/leads/42')
  })

  it('shows an empty state, not a broken table, when there are no meetings', () => {
    mockUseMeetings.mockReturnValue({
      data: { items: [], page: 1, page_size: 50, total: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<MeetingsPage />)
    expect(screen.getByText('No meetings found')).toBeInTheDocument()
  })

  it("denies access for the Engineer role, matching the backend's own restriction", () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    mockUseMeetings.mockReturnValue({
      data: { items: [MEETING], page: 1, page_size: 50, total: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<MeetingsPage />)

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Asha Roy')).not.toBeInTheDocument()
  })

  it('paginates — Next requests the next page from the hook', async () => {
    // total=51 forces 2 pages under the page's own fixed page_size=50, the
    // same convention Audit Log's pagination already uses.
    mockUseMeetings.mockReturnValue({
      data: { items: [MEETING], page: 1, page_size: 50, total: 51 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    const user = userEvent.setup()
    render(<MeetingsPage />)

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(mockUseMeetings).toHaveBeenLastCalledWith({ page: 2, page_size: 50 })
  })
})
