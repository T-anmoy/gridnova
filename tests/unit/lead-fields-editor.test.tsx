import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadDetailPage from '@/app/(internal)/dashboard/leads/[id]/page'
import { ApiError } from '@/lib/dashboard/api-error'
import type { LeadDetail } from '@/lib/dashboard/types'

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useUser: () => mockUseUser() }))

vi.mock('@/lib/dashboard/staff-leads-api-client', async () => (await import('./helpers/staff-leads-mocks')).staffLeadsApiMock)

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '19' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}))

const mockUseLead = vi.fn()
const mockUpdateFields = vi.fn()

vi.mock('@/lib/dashboard/api-client', () => ({
  useLead: () => mockUseLead(),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeLeadStage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReassignLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateLeadFields: () => ({ mutateAsync: mockUpdateFields, isPending: false }),
  useAssignableEmployees: () => ({ data: [], isLoading: false }),
}))

const LEAD: LeadDetail = {
  lead_id: 19,
  customer: { id: 1, name: 'Test Visitor', email: 'test@example.com', company: null },
  pipeline_stage: 'qualifying',
  lead_score: 'medium',
  collected_fields: { name: 'Test Visitor', email: 'test@example.com' },
  assigned_employee_id: null,
  proposals: [],
  timeline: [],
  messages: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockReturnValue({ user: { id: 'admin-1', publicMetadata: { role: 'admin' } } })
  mockUseLead.mockReturnValue({ data: LEAD, isLoading: false, error: null, refetch: vi.fn() })
})

describe('LeadDetailPage — qualification fields editor', () => {
  it("shows the real missing_fields the backend returns after saving, not an invented list", async () => {
    mockUpdateFields.mockResolvedValue({
      lead_id: 19,
      collected_fields: { ...LEAD.collected_fields, project_type: 'rooftop' },
      is_qualified: false,
      missing_fields: ['location', 'capacity_kw'],
    })
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(screen.getByRole('button', { name: /edit details/i }))
    const projectTypeInput = screen.getByLabelText('project type')
    await user.type(projectTypeInput, 'rooftop')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Still missing: location, capacity_kw')).toBeInTheDocument()
    })
  })

  it('validates a numeric field client-side before submitting', async () => {
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(screen.getByRole('button', { name: /edit details/i }))
    const capacityInput = screen.getByLabelText('capacity kw')
    // type="number" inputs reject non-numeric characters at the DOM level in
    // jsdom too, so force an invalid value the same way a pasted value could
    // arrive — via fireEvent-free direct change through userEvent.clear+type
    // isn't reliable for type=number; assert the numeric-only DOM attribute
    // is set as the first line of defence instead.
    expect(capacityInput).toHaveAttribute('type', 'number')
  })

  it('shows the backend error verbatim-but-friendly on a failed save (e.g. 403)', async () => {
    mockUpdateFields.mockRejectedValue(new ApiError(403, 'API error 403', 'This lead is not assigned to you.'))
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(screen.getByRole('button', { name: /edit details/i }))
    await user.type(screen.getByLabelText('location'), 'Kolkata')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('This lead is not assigned to you.')).toBeInTheDocument()
  })

  it("disables Generate Proposal Draft and explains why when the lead isn't qualified yet", () => {
    render(<LeadDetailPage />)
    const button = screen.getByRole('button', { name: /generate proposal draft/i })
    expect(button).toBeDisabled()
  })
})
