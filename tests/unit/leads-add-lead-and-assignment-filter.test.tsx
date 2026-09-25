import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadsPage from '@/app/dashboard/leads/page'
import type { LeadSummary } from '@/lib/dashboard/types'

const mockUseUser = vi.fn()
const mockUseAuth = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseAuth(),
}))

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}))

const mockUseLeads = vi.fn()
const mockCreateLead = vi.fn()
vi.mock('@/lib/dashboard/api-client', () => ({
  useLeads: (params: unknown) => mockUseLeads(params),
  useCreateLead: () => ({ mutateAsync: mockCreateLead, isPending: false }),
  downloadLeadsCsv: vi.fn(),
}))

const LEAD: LeadSummary = {
  id: 1,
  customer_id: 1,
  customer_name: 'Asha Roy',
  pipeline_stage: 'new',
  lead_score: 'high',
  source: 'website_chat',
  created_at: '2026-09-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue('token') })
  mockUseLeads.mockReturnValue({ data: [LEAD], isLoading: false, error: null, refetch: vi.fn() })
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('LeadsPage — assignment filter (admin, management and sales)', () => {
  it('sends the assigned=any param for Sales by default, and lets Sales switch it', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    const user = userEvent.setup()
    render(<LeadsPage />)

    expect(mockUseLeads).toHaveBeenLastCalledWith({ assigned: 'any' })

    // The assignment filter is the first combobox in this view — the others
    // (stage/score/source) render after it.
    const trigger = screen.getAllByRole('combobox')[0]
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'Assigned to me' }))

    await waitFor(() => {
      expect(mockUseLeads).toHaveBeenLastCalledWith({ assigned: 'me' })
    })
  })

  it('shows Admin and Management the filter too (they assign new website/chat leads), defaulting to no filter', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    const user = userEvent.setup()
    const { unmount } = render(<LeadsPage />)

    // Admin/management default to seeing everything — no `assigned` param
    // sent until they explicitly pick one.
    expect(mockUseLeads).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByText('All leads')).toBeInTheDocument()

    const trigger = screen.getAllByRole('combobox')[0]
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'Unassigned' }))
    await waitFor(() => {
      expect(mockUseLeads).toHaveBeenLastCalledWith({ assigned: 'unassigned' })
    })
    unmount()

    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'management' } } })
    render(<LeadsPage />)
    expect(mockUseLeads).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByText('All leads')).toBeInTheDocument()
  })

  it('never shows the filter to Engineer — it does not list leads that way', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    render(<LeadsPage />)
    expect(mockUseLeads).toHaveBeenLastCalledWith(undefined)
    expect(screen.queryByText('All leads')).not.toBeInTheDocument()
    expect(screen.queryByText('Mine + unassigned')).not.toBeInTheDocument()
  })
})

describe('LeadsPage — Add Lead dialog', () => {
  it('is hidden for Engineer (matches backend 403) and visible for Sales', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    const { unmount } = render(<LeadsPage />)
    expect(screen.queryByRole('button', { name: /add lead/i })).not.toBeInTheDocument()
    unmount()

    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    render(<LeadsPage />)
    expect(screen.getByRole('button', { name: /add lead/i })).toBeInTheDocument()
  })

  it('requires a name and at least one of phone/email before submitting', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    const user = userEvent.setup()
    render(<LeadsPage />)

    await user.click(screen.getByRole('button', { name: /add lead/i }))
    await user.click(screen.getByRole('button', { name: 'Create Lead' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(mockCreateLead).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Name *'), 'Ravi Sharma')
    await user.click(screen.getByRole('button', { name: 'Create Lead' }))
    expect(await screen.findByText('At least one of phone or email is required')).toBeInTheDocument()
    expect(mockCreateLead).not.toHaveBeenCalled()
  })

  it('creates the lead and navigates to it, showing the real is_qualified/missing_fields result', async () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'sales' } } })
    mockCreateLead.mockResolvedValue({
      lead_id: 42,
      customer_id: 5,
      customer_matched_existing: false,
      project_id: 9,
      project_reference_id: 'GN-0009',
      source: 'whatsapp',
      pipeline_stage: 'new',
      lead_score: 'medium',
      assigned_employee_id: 'sales-1',
      is_qualified: false,
      missing_fields: ['capacity_kw'],
    })
    const user = userEvent.setup()
    render(<LeadsPage />)

    await user.click(screen.getByRole('button', { name: /add lead/i }))
    await user.type(screen.getByLabelText('Name *'), 'Ravi Sharma')
    await user.type(screen.getByLabelText('Phone'), '9876543210')
    await user.click(screen.getByRole('button', { name: 'Create Lead' }))

    await waitFor(() => {
      expect(mockCreateLead).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ravi Sharma', phone: '9876543210', source: 'whatsapp' })
      )
      expect(pushMock).toHaveBeenCalledWith('/dashboard/leads/42')
    })
  })
})

describe('LeadsPage — stage summary strip', () => {
  it('shows real per-stage counts derived from the fetched leads, not an invented total', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } })
    mockUseLeads.mockReturnValue({
      data: [LEAD, { ...LEAD, id: 2, pipeline_stage: 'new' }, { ...LEAD, id: 3, pipeline_stage: 'won' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<LeadsPage />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
