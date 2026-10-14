import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadsPage from '@/app/(internal)/dashboard/leads/page'
import LeadDetailPage from '@/app/(internal)/dashboard/leads/[id]/page'
import { navState } from './helpers/mock-navigation'
import { leadItem, leadPage } from './fixtures/leads-contract'
import { parseApiError } from '@/lib/api/http'
import { staffLeadsCopyFor } from '@/lib/dashboard/staff-leads-copy'
import type { LeadDetail, Role } from '@/lib/dashboard/types'

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('token') }),
}))
vi.mock('next/navigation', async () => ({
  ...(await import('./helpers/mock-navigation')).navigationMock,
  useParams: () => ({ id: '19' }),
}))
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }))

const mockUseLeads = vi.fn()
const mockUseLead = vi.fn()
const mockDownload = vi.fn()
vi.mock('@/lib/dashboard/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dashboard/api-client')>()),
  useLeads: (params: unknown) => mockUseLeads(params),
  useLead: () => mockUseLead(),
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeLeadStage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReassignLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateLeadFields: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssignableEmployees: () => ({ data: [], isLoading: false }),
  downloadLeadsCsv: (...a: unknown[]) => mockDownload(...a),
}))

const mockUseCustomerMemory = vi.fn()
vi.mock('@/lib/dashboard/staff-leads-api-client', () => ({
  useScheduleMeeting: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAskMemory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReflectLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCustomerMemory: (...a: unknown[]) => mockUseCustomerMemory(...a),
}))

const en = staffLeadsCopyFor('en')
const asRole = (role: Role | undefined) => mockUseUser.mockReturnValue({ user: { id: 'user-1', publicMetadata: { role } } })
const listOk = (data = leadPage([leadItem(12)])) => ({ data, isLoading: false, error: null, refetch: vi.fn(), isPlaceholderData: false })

beforeEach(() => {
  vi.clearAllMocks()
  navState.reset('/dashboard/leads')
  asRole('admin')
  mockUseLeads.mockReturnValue(listOk())
  mockUseCustomerMemory.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, error: null, refetch: vi.fn() })
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Leads list — server-side filters', () => {
  it('changing a filter resets to page 1 and puts the filter in the URL (stage repeated)', async () => {
    navState.reset('/dashboard/leads', 'page=3&stage=new')
    const user = userEvent.setup()
    render(<LeadsPage />)
    await user.click(screen.getByRole('checkbox', { name: 'Won' }))
    expect(navState.params.has('page')).toBe(false)
    expect(navState.params.getAll('stage')).toEqual(['new', 'won'])
    expect(mockUseLeads).toHaveBeenLastCalledWith({ page: 1, page_size: 25, stage: ['new', 'won'] })
  })

  it('the score range and dates reach the request and the URL', async () => {
    const user = userEvent.setup()
    render(<LeadsPage />)
    await user.selectOptions(screen.getByLabelText('Lowest score'), 'medium')
    expect(navState.params.get('min_score')).toBe('medium')
    expect(mockUseLeads).toHaveBeenLastCalledWith({ page: 1, page_size: 25, min_score: 'medium' })
  })

  it('pagination uses the server total, which is the filtered count', () => {
    navState.reset('/dashboard/leads', 'stage=won')
    mockUseLeads.mockReturnValue(listOk(leadPage([leadItem(1)], { total: 120 })))
    render(<LeadsPage />)
    expect(screen.getByText('120 matching leads')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 5 · 120 leads')).toBeInTheDocument()
  })

  it('does not send an inverted range, and says what is wrong', () => {
    navState.reset('/dashboard/leads', 'created_from=2026-09-05&created_to=2026-09-01&min_score=high&max_score=low')
    render(<LeadsPage />)
    expect(mockUseLeads).toHaveBeenLastCalledWith({ page: 1, page_size: 25 })
    expect(screen.getByText(en.filters.errors.invalid_date_range)).toBeInTheDocument()
    expect(screen.getByText(en.filters.errors.invalid_score_range)).toBeInTheDocument()
  })

  it.each([
    ['unknown_stage', 'stage'],
    ['unknown_score', 'max_score'],
    ['invalid_score_range', 'min_score'],
    ['invalid_date', 'created_to'],
    ['invalid_date_range', 'created_from'],
  ] as const)('a structured 422 %s is a field message in our words, not a crash or the server text', (code, field) => {
    navState.reset('/dashboard/leads', 'created_from=2026-09-01')
    const error = parseApiError(422, 'Unprocessable', JSON.stringify({ detail: { code, message: 'SERVER WORDS', field } }))
    mockUseLeads.mockReturnValue({ data: undefined, isLoading: false, error, refetch: vi.fn(), isPlaceholderData: false })
    render(<LeadsPage />)
    expect(screen.getByText(en.filters.errors[code])).toBeInTheDocument()
    expect(screen.queryByText('SERVER WORDS')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leads' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('any other error still gets the normal error card', () => {
    mockUseLeads.mockReturnValue({ data: undefined, isLoading: false, error: parseApiError(500, 'x', 'boom'), refetch: vi.fn(), isPlaceholderData: false })
    render(<LeadsPage />)
    expect(screen.getByText(/The server ran into a problem/)).toBeInTheDocument()
  })

  it('Clear filters clears the filters and the page', async () => {
    navState.reset('/dashboard/leads', 'page=2&stage=new&min_score=low&created_from=2026-09-01')
    const user = userEvent.setup()
    render(<LeadsPage />)
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(navState.search).toBe('')
  })

  it('shows "no leads match" when filters leave nothing, and a dash for an unscored lead', () => {
    navState.reset('/dashboard/leads', 'stage=won')
    mockUseLeads.mockReturnValue(listOk(leadPage([])))
    const { unmount } = render(<LeadsPage />)
    expect(screen.getByText(en.list.noMatch)).toBeInTheDocument()
    unmount()
    navState.reset('/dashboard/leads')
    mockUseLeads.mockReturnValue(listOk(leadPage([leadItem(5, { lead_score: null })])))
    render(<LeadsPage />)
    const row = screen.getByText('#5').closest('tr') as HTMLElement
    expect(within(row).getByText('—', { selector: 'span' })).toBeInTheDocument()
  })
})

describe('Leads list — export and role gating', () => {
  it.each([
    ['admin', true], ['management', true], ['sales', false], ['engineer', false],
  ] as const)('%s sees the export button: %s', (role, shown) => {
    asRole(role)
    render(<LeadsPage />)
    expect(!!screen.queryByRole('button', { name: en.export.button })).toBe(shown)
  })

  it('the export carries the same active filters', async () => {
    navState.reset('/dashboard/leads', 'stage=new&stage=lost&max_score=medium&created_from=2026-09-01&created_to=2026-09-03')
    const user = userEvent.setup()
    render(<LeadsPage />)
    await user.click(screen.getByRole('button', { name: en.export.button }))
    expect(mockDownload).toHaveBeenCalledWith(
      { stage: ['new', 'lost'], max_score: 'medium', created_from: '2026-09-01', created_to: '2026-09-03', source: undefined },
      'token',
    )
  })

  it('a 403 on export is a calm message, and the page stays up', async () => {
    mockDownload.mockRejectedValue(parseApiError(403, 'Forbidden', JSON.stringify({ detail: 'Only Admin or Management can export leads.' })))
    const user = userEvent.setup()
    render(<LeadsPage />)
    await user.click(screen.getByRole('button', { name: en.export.button }))
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith(en.export.forbidden))
    expect(screen.getByRole('button', { name: en.export.button })).toBeEnabled()
  })

  it('Operations and Accounts get a no-access state, not a list', () => {
    for (const role of ['operations', 'accounts'] as const) {
      asRole(role)
      const { unmount } = render(<LeadsPage />)
      expect(screen.getByTestId('no-access')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      unmount()
    }
  })
})

// ── Lead detail ──────────────────────────────────────────────────────────────

const FULL: LeadDetail = {
  lead_id: 19,
  customer: { id: 7, name: 'Test Customer A', email: 'a@example.test', company: null },
  pipeline_stage: 'qualified',
  lead_score: 'high',
  collected_fields: { name: 'x', email: 'x', project_type: 'x', location: 'x', capacity_kw: 5 },
  assigned_employee_id: null,
  proposals: [{ id: 3, version: 1, status: 'draft', total_value: null }],
  timeline: [{ event_type: 'note_added', description: 'Synthetic timeline note', created_at: '2026-10-10T04:00:00+00:00' }],
  messages: [{ role: 'customer', content: 'Synthetic message', created_at: '2026-10-10T04:00:00+00:00' }],
}
const loaded = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })

describe('Lead detail — Engineer shape', () => {
  const ENGINEER = { lead_id: 19, pipeline_stage: 'qualified', collected_fields: { project_type: 'rooftop', capacity_kw: 5, location: 'Test City', roof_type: 'flat' } }

  it('renders the technical view only, with no customer, proposals, timeline, messages or actions', () => {
    asRole('engineer')
    mockUseLead.mockReturnValue(loaded(ENGINEER))
    render(<LeadDetailPage />)
    expect(screen.getByTestId('engineer-lead-view')).toBeInTheDocument()
    expect(screen.getByText('rooftop')).toBeInTheDocument()
    expect(screen.getByText('Test City')).toBeInTheDocument()
    for (const name of [/Change Stage/, /Reassign/, /Edit Details/, /Site Assessment/, /Generate Proposal Draft/, /Schedule meeting/, /Reflect/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    for (const text of ['Customer', 'Proposals', 'Timeline', 'Conversation', 'Ask memory', 'Customer memory']) {
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    }
    expect(mockUseCustomerMemory).not.toHaveBeenCalled()
  })

  it('is decided by the response, not the role: the same shape for an admin is still technical only', () => {
    asRole('admin')
    mockUseLead.mockReturnValue(loaded(ENGINEER))
    render(<LeadDetailPage />)
    expect(screen.getByTestId('engineer-lead-view')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Schedule meeting/ })).not.toBeInTheDocument()
  })

  it('a full shape with customer: null is not treated as the Engineer shape', () => {
    asRole('admin')
    mockUseLead.mockReturnValue(loaded({ ...FULL, customer: null }))
    render(<LeadDetailPage />)
    expect(screen.queryByTestId('engineer-lead-view')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Change Stage/ })).toBeInTheDocument()
  })
})

describe('Lead detail — errors', () => {
  const failed = (error: unknown) => ({ data: undefined, isLoading: false, error, refetch: vi.fn() })

  it('403 "not assigned to you" is its own clear state, with no retry', () => {
    asRole('sales')
    mockUseLead.mockReturnValue(failed(parseApiError(403, 'Forbidden', JSON.stringify({ detail: 'This lead is not assigned to you.' }))))
    render(<LeadDetailPage />)
    expect(screen.getByTestId('lead-not-assigned')).toHaveTextContent(en.detail.notAssignedTitle)
    expect(screen.queryByRole('button', { name: en.common.retry })).not.toBeInTheDocument()
    expect(screen.queryByText(en.detail.loadFailed)).not.toBeInTheDocument()
  })

  it('404 says not found with no retry; a server error offers a retry', () => {
    asRole('admin')
    mockUseLead.mockReturnValue(failed(parseApiError(404, 'x', JSON.stringify({ detail: 'Lead not found' }))))
    const { unmount } = render(<LeadDetailPage />)
    expect(screen.getByText(en.detail.notFound)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.common.retry })).not.toBeInTheDocument()
    unmount()
    mockUseLead.mockReturnValue(failed(parseApiError(500, 'x', 'boom')))
    render(<LeadDetailPage />)
    expect(screen.getByText(en.detail.loadFailed)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.common.retry })).toBeInTheDocument()
  })
})

describe('Lead detail — role gating of the new actions', () => {
  it.each([
    // role, schedule, reflect + memory + ask
    ['admin', true, true],
    ['management', false, true],
    ['sales', true, true],
    ['engineer', false, false],
    ['operations', false, false],
    ['accounts', false, false],
  ] as const)('%s: schedule=%s, reflect/memory/ask=%s', (role, schedule, memory) => {
    asRole(role)
    mockUseLead.mockReturnValue(loaded(FULL))
    render(<LeadDetailPage />)
    expect(!!screen.queryByRole('button', { name: en.meeting.action })).toBe(schedule)
    expect(!!screen.queryByRole('button', { name: en.reflect.action })).toBe(memory)
    expect(!!screen.queryByText(en.memory.title)).toBe(memory)
    expect(!!screen.queryByText(en.ask.title)).toBe(memory)
    if (memory) expect(mockUseCustomerMemory).toHaveBeenCalledWith(7, { kind: undefined, limit: 100 })
    else expect(mockUseCustomerMemory).not.toHaveBeenCalled()
  })

  it('the existing customer, proposals, timeline and conversation still show for a full shape', () => {
    asRole('admin')
    mockUseLead.mockReturnValue(loaded(FULL))
    render(<LeadDetailPage />)
    expect(screen.getByText('Test Customer A')).toBeInTheDocument()
    expect(screen.getByText('Synthetic timeline note')).toBeInTheDocument()
    expect(screen.getByText('Synthetic message')).toBeInTheDocument()
    expect(screen.getByText(/Proposal #3/)).toBeInTheDocument()
  })
})
