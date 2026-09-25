import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import MeetingsPage from '@/app/dashboard/meetings/page'

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useUser: () => mockUseUser() }))

const pushMock = vi.fn()
const replaceMock = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUseMeetings = vi.fn()
const mockUseEmployeeMe = vi.fn()
const mockConnectCalendar = vi.fn()
vi.mock('@/lib/dashboard/api-client', () => ({
  useMeetings: () => mockUseMeetings(),
  useEmployeeMe: () => mockUseEmployeeMe(),
  useConnectCalendar: () => ({ mutateAsync: mockConnectCalendar, isPending: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
  mockUseMeetings.mockReturnValue({ data: { items: [], page: 1, page_size: 50, total: 0 }, isLoading: false, error: null, refetch: vi.fn() })
  mockSearchParams = new URLSearchParams()
})

describe('MeetingsPage — Google Calendar connect status', () => {
  it('shows "not connected" and a Connect button when the employee has no calendar linked', () => {
    mockUseEmployeeMe.mockReturnValue({ data: { id: 'me', role: 'admin', is_active: true, google_calendar_connected: false }, isLoading: false })
    render(<MeetingsPage />)
    expect(screen.getByText('Google Calendar not connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument()
  })

  it('shows "connected" and hides the Connect button once linked', () => {
    mockUseEmployeeMe.mockReturnValue({ data: { id: 'me', role: 'admin', is_active: true, google_calendar_connected: true }, isLoading: false })
    render(<MeetingsPage />)
    expect(screen.getByText('Google Calendar connected')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect google calendar/i })).not.toBeInTheDocument()
  })

  it('navigates the browser to the returned authorization_url on Connect', async () => {
    mockUseEmployeeMe.mockReturnValue({ data: { id: 'me', role: 'admin', is_active: true, google_calendar_connected: false }, isLoading: false })
    mockConnectCalendar.mockResolvedValue({ authorization_url: 'https://accounts.google.com/o/oauth2/auth?foo=bar' })
    const originalLocation = window.location
    // jsdom's window.location.href setter throws "Not implemented: navigation" —
    // stub it so the redirect assertion doesn't crash the test.
    Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true })
    const user = userEvent.setup()
    render(<MeetingsPage />)

    await user.click(screen.getByRole('button', { name: /connect google calendar/i }))
    await waitFor(() => {
      expect(window.location.href).toBe('https://accounts.google.com/o/oauth2/auth?foo=bar')
    })
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('shows a success toast and cleans the query string for ?calendar=connected', () => {
    mockUseEmployeeMe.mockReturnValue({ data: { id: 'me', role: 'admin', is_active: true, google_calendar_connected: true }, isLoading: false })
    mockSearchParams = new URLSearchParams('calendar=connected')
    render(<MeetingsPage />)
    expect(toast.success).toHaveBeenCalledWith('Google Calendar connected')
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/meetings')
  })

  it('maps every documented calendar error reason to a plain-English toast', () => {
    mockUseEmployeeMe.mockReturnValue({ data: { id: 'me', role: 'admin', is_active: true, google_calendar_connected: false }, isLoading: false })
    mockSearchParams = new URLSearchParams('calendar=error&reason=access_denied')
    render(<MeetingsPage />)
    expect(toast.error).toHaveBeenCalledWith('Google Calendar access was denied.')
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/meetings')
  })

  it('falls back to a generic error toast for an unrecognized reason, never a raw code', () => {
    mockUseEmployeeMe.mockReturnValue({ data: { id: 'me', role: 'admin', is_active: true, google_calendar_connected: false }, isLoading: false })
    mockSearchParams = new URLSearchParams('calendar=error&reason=something_new')
    render(<MeetingsPage />)
    expect(toast.error).toHaveBeenCalledWith('Could not connect Google Calendar')
  })
})
