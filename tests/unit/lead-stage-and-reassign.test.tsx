import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadDetailPage from '@/app/(internal)/dashboard/leads/[id]/page'
import type { LeadDetail } from '@/lib/dashboard/types'
import { ASSIGNABLE_EMPLOYEES_FIXTURE } from './fixtures/dashboard-contract'

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useUser: () => mockUseUser() }))

vi.mock('@/lib/dashboard/staff-leads-api-client', async () => (await import('./helpers/staff-leads-mocks')).staffLeadsApiMock)

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '19' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/leads/19',
  useSearchParams: () => new URLSearchParams(),
}))

const mockUseLead = vi.fn()
const mockChangeStage = vi.fn()
const mockReassign = vi.fn()
const mockUpdateFields = vi.fn()
const mockUseAssignableEmployees = vi.fn()

vi.mock('@/lib/dashboard/api-client', () => ({
  useLead: () => mockUseLead(),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeLeadStage: () => ({ mutateAsync: mockChangeStage, isPending: false }),
  useReassignLead: () => ({ mutateAsync: mockReassign, isPending: false }),
  useUpdateLeadFields: () => ({ mutateAsync: mockUpdateFields, isPending: false }),
  useAssignableEmployees: () => mockUseAssignableEmployees(),
}))

const BASE_LEAD: LeadDetail = {
  lead_id: 19,
  customer: { id: 1, name: 'Test Visitor', email: 'test@example.com', company: null },
  pipeline_stage: 'qualified',
  lead_score: 'high',
  collected_fields: { name: 'x', email: 'x', project_type: 'x', location: 'x', capacity_kw: 5 },
  assigned_employee_id: null,
  proposals: [],
  timeline: [],
  messages: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAssignableEmployees.mockReturnValue({ data: ASSIGNABLE_EMPLOYEES_FIXTURE, isLoading: false })
  // jsdom doesn't implement pointer-capture or scrollIntoView, which Radix
  // Select's trigger relies on when opened.
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('LeadDetailPage — stage change reason rules', () => {
  it('does not require a reason for an ordinary forward stage move', async () => {
    mockUseUser.mockReturnValue({ user: { id: 'user-1', publicMetadata: { role: 'admin' } } })
    mockUseLead.mockReturnValue({ data: BASE_LEAD, isLoading: false, error: null, refetch: vi.fn() })
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(screen.getByRole('button', { name: /change stage/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveTextContent('Reason *')
  })

  it('requires a non-blank reason when moving a lead to lost, and blocks whitespace-only reasons', async () => {
    mockUseUser.mockReturnValue({ user: { id: 'user-1', publicMetadata: { role: 'admin' } } })
    mockUseLead.mockReturnValue({ data: BASE_LEAD, isLoading: false, error: null, refetch: vi.fn() })
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(screen.getByRole('button', { name: /change stage/i }))
    const dialog = await screen.findByRole('dialog')

    // Switch the stage select to "lost"
    const trigger = screen.getAllByRole('combobox')[0]
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'lost' }))

    expect(dialog).toHaveTextContent('Reason *')
    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmButton).toBeDisabled()

    const textarea = screen.getByPlaceholderText('Why was this lead lost?')
    await user.type(textarea, '   ')
    expect(confirmButton).toBeDisabled()

    await user.type(textarea, 'Customer went with a competitor')
    expect(confirmButton).not.toBeDisabled()
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockChangeStage).toHaveBeenCalledWith({ leadId: 19, stage: 'lost', reason: 'Customer went with a competitor' })
    })
  })

  it('requires a reason when reopening a lead out of won/lost', async () => {
    mockUseUser.mockReturnValue({ user: { id: 'user-1', publicMetadata: { role: 'admin' } } })
    mockUseLead.mockReturnValue({
      data: { ...BASE_LEAD, pipeline_stage: 'won' },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(screen.getByRole('button', { name: /change stage/i }))
    const trigger = screen.getAllByRole('combobox')[0]
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'negotiation' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Reason *')
  })

  it("Sales can change the stage of an unassigned lead but not one assigned to someone else", () => {
    mockUseUser.mockReturnValue({ user: { id: 'sales-1', publicMetadata: { role: 'sales' } } })

    mockUseLead.mockReturnValue({
      data: { ...BASE_LEAD, assigned_employee_id: null },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    const { unmount } = render(<LeadDetailPage />)
    expect(screen.getByRole('button', { name: /change stage/i })).toBeInTheDocument()
    unmount()

    mockUseLead.mockReturnValue({
      data: { ...BASE_LEAD, assigned_employee_id: 'someone-else' },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    render(<LeadDetailPage />)
    expect(screen.queryByRole('button', { name: /change stage/i })).not.toBeInTheDocument()
  })

  it('hides Reassign for Sales and shows it for Admin/Management', () => {
    mockUseUser.mockReturnValue({ user: { id: 'sales-1', publicMetadata: { role: 'sales' } } })
    mockUseLead.mockReturnValue({ data: BASE_LEAD, isLoading: false, error: null, refetch: vi.fn() })
    const { unmount } = render(<LeadDetailPage />)
    expect(screen.queryByRole('button', { name: 'Reassign' })).not.toBeInTheDocument()
    unmount()

    mockUseUser.mockReturnValue({ user: { id: 'admin-1', publicMetadata: { role: 'admin' } } })
    render(<LeadDetailPage />)
    expect(screen.getByRole('button', { name: 'Reassign' })).toBeInTheDocument()
  })

  it('gives Management the same real employee picker as Admin, from GET /employees/assignable — no more plain-text ID field', async () => {
    mockUseUser.mockReturnValue({ user: { id: 'mgmt-1', publicMetadata: { role: 'management' } } })
    mockUseLead.mockReturnValue({ data: BASE_LEAD, isLoading: false, error: null, refetch: vi.fn() })
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(screen.getByRole('button', { name: 'Reassign' }))
    expect(screen.queryByPlaceholderText('Employee ID')).not.toBeInTheDocument()
    const trigger = await screen.findByRole('combobox')
    await user.click(trigger)
    expect(await screen.findByRole('option', { name: /Ravi Sharma/i })).toBeInTheDocument()
  })

  it('never calls the admin-only /employees for either Admin or Management — only /employees/assignable', () => {
    mockUseUser.mockReturnValue({ user: { id: 'admin-1', publicMetadata: { role: 'admin' } } })
    mockUseLead.mockReturnValue({ data: BASE_LEAD, isLoading: false, error: null, refetch: vi.fn() })
    render(<LeadDetailPage />)
    expect(mockUseAssignableEmployees).toHaveBeenCalled()
  })
})
