import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parseApiError } from '@/lib/api/http'
import { ApiError } from '@/lib/dashboard/api-error'
import { staffLeadsCopy, useStaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import { LeadFilterPanel } from '@/components/dashboard/LeadFilterPanel'
import { ScheduleMeetingDialog } from '@/components/dashboard/ScheduleMeetingDialog'
import { ReflectButton } from '@/components/dashboard/ReflectButton'
import { AskMemoryPanel } from '@/components/dashboard/AskMemoryPanel'
import { CustomerMemoryPanel } from '@/components/dashboard/CustomerMemoryPanel'
import { EMPTY_FILTERS } from '@/lib/dashboard/lead-filters'
import type { LeadFilters, MemoryAskResponse } from '@/lib/dashboard/staff-leads-types'

const mockSchedule = vi.fn()
const mockReflect = vi.fn()
const mockAsk = vi.fn()
const mockUseCustomerMemory = vi.fn()
let schedulePending = false
let reflectPending = false

vi.mock('@/lib/dashboard/staff-leads-api-client', () => ({
  useScheduleMeeting: () => ({ mutateAsync: mockSchedule, isPending: schedulePending }),
  useReflectLead: () => ({ mutateAsync: mockReflect, isPending: reflectPending }),
  useAskMemory: () => ({ mutateAsync: mockAsk, isPending: false }),
  useCustomerMemory: (...args: unknown[]) => mockUseCustomerMemory(...args),
}))

const en = staffLeadsCopy
const apiErr = (status: number, detail: unknown) => parseApiError(status, 'x', JSON.stringify({ detail }))

beforeEach(() => {
  vi.clearAllMocks()
  schedulePending = false
  reflectPending = false
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

// ── Filter panel ─────────────────────────────────────────────────────────────

describe('LeadFilterPanel', () => {
  const setup = (filters: Partial<LeadFilters> = {}, serverError: { code: 'unknown_stage'; field: string } | null = null) => {
    const onChange = vi.fn()
    const onClear = vi.fn()
    render(<LeadFilterPanel filters={{ ...EMPTY_FILTERS, ...filters }} onChange={onChange} onClear={onClear} showClear={false} serverError={serverError} copy={en} />)
    return { onChange, onClear }
  }

  it('offers all eight stages as keyboard-operable checkboxes, in pipeline order', () => {
    setup()
    const group = screen.getByRole('group', { name: 'Pipeline stage' })
    const boxes = within(group).getAllByRole('checkbox')
    expect(boxes.map((b) => (b.closest('label') as HTMLElement).textContent)).toEqual([
      'New', 'Qualifying', 'Qualified', 'Proposal draft', 'Proposal sent', 'Negotiation', 'Won', 'Lost',
    ])
  })

  it('checking a stage reports the new list, in pipeline order', async () => {
    const user = userEvent.setup()
    const { onChange } = setup({ stages: ['won'] })
    await user.click(screen.getByRole('checkbox', { name: 'New' }))
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, stages: ['new', 'won'] })
  })

  it('a stage can be toggled with the keyboard', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    screen.getByRole('checkbox', { name: 'Lost' }).focus()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, stages: ['lost'] })
  })

  it('score range and dates are labelled and report changes', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.selectOptions(screen.getByLabelText('Lowest score'), 'medium')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, minScore: 'medium' })
    await user.selectOptions(screen.getByLabelText('Highest score'), 'high')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, maxScore: 'high' })
    await act(async () => {
      const input = screen.getByLabelText('Created from') as HTMLInputElement
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      set.call(input, '2026-09-01')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, createdFrom: '2026-09-01' })
  })

  it('says leads with no score never match a score filter, and that dates are IST days', () => {
    setup()
    expect(screen.getByText('Leads with no score never match a score filter.')).toBeInTheDocument()
    expect(screen.getByText(/calendar days in India time \(IST\), both ends included/)).toBeInTheDocument()
  })

  it('shows the client guard message next to an inverted score range and date range', () => {
    setup({ minScore: 'high', maxScore: 'low', createdFrom: '2026-09-05', createdTo: '2026-09-01' })
    expect(screen.getByText(en.filters.errors.invalid_score_range)).toBeInTheDocument()
    expect(screen.getByText(en.filters.errors.invalid_date_range)).toBeInTheDocument()
    expect(screen.getByLabelText('Lowest score')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a server 422 by code, in the right group, in the reader\'s language', () => {
    render(<LeadFilterPanel filters={EMPTY_FILTERS} onChange={vi.fn()} onClear={vi.fn()} showClear={false} serverError={{ code: 'unknown_stage', field: 'stage' }} copy={en} />)
    expect(screen.getByText(en.filters.errors.unknown_stage)).toBeInTheDocument()
  })

  it('collapses behind a toggle on small screens and reports its state', async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole('button', { name: /Show filters/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: /Hide filters/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('starts open when a filter is already active (a shared link)', () => {
    setup({ stages: ['new'] })
    expect(screen.getByRole('button', { name: /Hide filters/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('1 active')).toBeInTheDocument()
  })

  it('every control meets the 44px touch target', () => {
    setup()
    for (const box of screen.getAllByRole('checkbox')) expect((box.closest('label') as HTMLElement).className).toContain('min-h-11')
    expect(screen.getByLabelText('Lowest score').className).toContain('min-h-11')
    expect(screen.getByLabelText('Created to').className).toContain('min-h-11')
  })
})

// ── Locale ───────────────────────────────────────────────────────────────────

describe('staff Leads copy is English-only', () => {
  it('ignores the NEXT_LOCALE cookie, before and after mount', async () => {
    document.cookie = 'NEXT_LOCALE=bn; path=/'
    function Probe() {
      return <p>{useStaffLeadsCopy().filters.clear}</p>
    }
    render(<Probe />)
    await Promise.resolve()
    expect(screen.getByText(staffLeadsCopy.filters.clear)).toBeInTheDocument()
    document.cookie = 'NEXT_LOCALE=; path=/; max-age=0'
  })

  it('carries only the English namespace', async () => {
    const generated = (await import('@/lib/dashboard/staff-leads-copy.generated.json')).default
    expect(Object.keys(generated)).toEqual(['en'])
  })
})

// ── Schedule meeting ─────────────────────────────────────────────────────────

describe('ScheduleMeetingDialog', () => {
  async function open() {
    const user = userEvent.setup()
    render(<ScheduleMeetingDialog leadId={12} copy={en} />)
    await user.click(screen.getByRole('button', { name: 'Schedule meeting' }))
    return user
  }
  const fillWhen = async (user: ReturnType<typeof userEvent.setup>, v = '2026-10-20T10:30') => {
    await user.type(screen.getByLabelText('Date and time'), v)
  }

  it('sends an IST ISO value with offset, and no duration when blank', async () => {
    mockSchedule.mockResolvedValue({ meeting_id: 5, lead_id: 12, employee_id: 'emp-1', scheduled_at: '2026-10-20T05:00:00+00:00', duration_minutes: 30, meet_link: null, status: 'scheduled' })
    const user = await open()
    await fillWhen(user)
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() => expect(mockSchedule).toHaveBeenCalledTimes(1))
    expect(mockSchedule).toHaveBeenCalledWith({ leadId: 12, body: { scheduled_at: '2026-10-20T10:30:00+05:30' } })
  })

  it('sends the duration when given', async () => {
    mockSchedule.mockResolvedValue({ meeting_id: 5, lead_id: 12, employee_id: 'emp-1', scheduled_at: '2026-10-20T05:00:00+00:00', duration_minutes: 45, meet_link: null, status: 'scheduled' })
    const user = await open()
    await fillWhen(user)
    await user.type(screen.getByLabelText('Duration (minutes)'), '45')
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() => expect(mockSchedule).toHaveBeenCalled())
    expect(mockSchedule.mock.calls[0][0].body).toEqual({ scheduled_at: '2026-10-20T10:30:00+05:30', duration_minutes: 45 })
  })

  it('shows the result in IST with duration, status and a safe new-tab Meet link', async () => {
    mockSchedule.mockResolvedValue({ meeting_id: 5, lead_id: 12, employee_id: 'emp-1', scheduled_at: '2026-10-20T05:00:00+00:00', duration_minutes: 30, meet_link: 'https://meet.example.test/abc-defg', status: 'scheduled' })
    const user = await open()
    await fillWhen(user)
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(await screen.findByText('Meeting scheduled')).toBeInTheDocument()
    expect(screen.getByText(/20 Oct 2026.*10:30.* IST/)).toBeInTheDocument()
    expect(screen.getByText('30 minutes')).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Open the Meet link/ })
    expect(link).toHaveAttribute('href', 'https://meet.example.test/abc-defg')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows no link when meet_link is null', async () => {
    mockSchedule.mockResolvedValue({ meeting_id: 5, lead_id: 12, employee_id: 'emp-1', scheduled_at: '2026-10-20T05:00:00+00:00', duration_minutes: 30, meet_link: null, status: 'scheduled' })
    const user = await open()
    await fillWhen(user)
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await screen.findByText('Meeting scheduled')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(en.meeting.noLink)).toBeInTheDocument()
  })

  it('blocks an empty time and a bad duration without calling the server', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(screen.getByRole('alert')).toHaveTextContent(en.meeting.errors.invalidTime)
    await fillWhen(user)
    await user.type(screen.getByLabelText('Duration (minutes)'), '0')
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(screen.getByRole('alert')).toHaveTextContent(en.meeting.errors.invalidDuration)
    expect(mockSchedule).not.toHaveBeenCalled()
  })

  it.each(['4', '481'])('duration %s is refused with the translated 5–480 message', async (v) => {
    const user = await open()
    await fillWhen(user)
    await user.type(screen.getByLabelText('Duration (minutes)'), v)
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(screen.getByRole('alert')).toHaveTextContent('5 to 480')
    expect(mockSchedule).not.toHaveBeenCalled()
  })

  it('the duration input advertises min 5 and max 480', async () => {
    await open()
    const input = screen.getByLabelText('Duration (minutes)')
    expect(input).toHaveAttribute('min', '5')
    expect(input).toHaveAttribute('max', '480')
  })

  it('the memory kind filter lists insight and self-critique', () => {
    mockUseCustomerMemory.mockReturnValue({ data: { customer: { customer_id: 7, name: 'Test', email: 't@example.test', company: null }, profile: null, memory_count: 0, memories: [] }, isLoading: false, isFetching: false, error: null, refetch: vi.fn() })
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    const opts = within(screen.getByLabelText('Kind')).getAllByRole('option').map((o) => o.textContent)
    expect(opts).toEqual(['All kinds', 'Episode', 'Preference', 'Objection', 'Commitment', 'Outcome', 'Insight', 'Self-critique'])
  })

  it.each([
    [403, 'Your role cannot schedule meetings.', en.meeting.errors.role, null],
    [403, 'This lead is not assigned to you.', en.meeting.errors.notAssigned, null],
    [404, 'Lead not found', en.meeting.errors.notFound, null],
    [409, 'No connected Google Calendar available to book this meeting on.', en.meeting.errors.noCalendar, null],
    [409, 'That slot is already taken.', en.meeting.errors.conflict, 'That slot is already taken.'],
    [503, 'Google Calendar is not configured.', en.meeting.errors.notConfigured, 'Google Calendar is not configured.'],
  ])('%i "%s" shows the translated message', async (status, detail, message, serverText) => {
    mockSchedule.mockRejectedValue(apiErr(status, detail))
    const user = await open()
    await fillWhen(user)
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(alert).toHaveTextContent(message))
    if (serverText) expect(alert).toHaveTextContent(serverText)
    else if (message !== detail) expect(alert).not.toHaveTextContent(detail)
  })

  it('a dropped connection gets the network message', async () => {
    mockSchedule.mockRejectedValue(new ApiError(0, 'Network request failed'))
    const user = await open()
    await fillWhen(user)
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.meeting.errors.network))
  })

  it('disables the submit button while the request runs', async () => {
    schedulePending = true
    await open()
    expect(screen.getByRole('button', { name: 'Scheduling…' })).toBeDisabled()
  })
})

// ── Reflect ──────────────────────────────────────────────────────────────────

describe('ReflectButton', () => {
  it('shows how many memories were written', async () => {
    mockReflect.mockResolvedValue({ trigger: 'manual', lead_id: 12, memories_written: 3, skipped: null })
    const user = userEvent.setup()
    render(<ReflectButton leadId={12} copy={en} />)
    await user.click(screen.getByRole('button', { name: en.reflect.action }))
    expect(mockReflect).toHaveBeenCalledWith(12)
    expect(await screen.findByText('3 memories written.')).toBeInTheDocument()
  })

  it.each([
    ['no new messages since last reflection', en.reflect.skipped.noNewMessages],
    ['reflection returned nothing', en.reflect.skipped.nothingReturned],
    ['lead not found', en.reflect.skipped.leadNotFound],
    ['error: internal stack detail', en.reflect.skipped.error],
  ])('a skipped run ("%s") writes nothing and says so neutrally', async (skipped, line) => {
    mockReflect.mockResolvedValue({ trigger: 'manual', lead_id: 12, memories_written: 5, skipped })
    const user = userEvent.setup()
    render(<ReflectButton leadId={12} copy={en} />)
    await user.click(screen.getByRole('button', { name: en.reflect.action }))
    const status = await screen.findByText(new RegExp(en.reflect.skippedPrefix))
    expect(status).toHaveTextContent(line)
    expect(status).not.toHaveTextContent(/memories written/)
    expect(status).not.toHaveTextContent('internal stack detail')
  })

  it('an unknown reason is shown with its server text', async () => {
    mockReflect.mockResolvedValue({ trigger: 'manual', lead_id: 12, memories_written: 0, skipped: 'some new reason' })
    const user = userEvent.setup()
    render(<ReflectButton leadId={12} copy={en} />)
    await user.click(screen.getByRole('button', { name: en.reflect.action }))
    expect(await screen.findByText(/some new reason/)).toBeInTheDocument()
  })

  it('cannot be clicked twice while running', () => {
    reflectPending = true
    render(<ReflectButton leadId={12} copy={en} />)
    const btn = screen.getByRole('button', { name: en.reflect.running })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('maps a 403 from another rep\'s customer', async () => {
    mockReflect.mockRejectedValue(apiErr(403, "This customer's leads are assigned to another rep."))
    const user = userEvent.setup()
    render(<ReflectButton leadId={12} copy={en} />)
    await user.click(screen.getByRole('button', { name: en.reflect.action }))
    expect(await screen.findByText(en.reflect.errors.anotherRep)).toBeInTheDocument()
  })
})

// ── Ask memory ───────────────────────────────────────────────────────────────

describe('AskMemoryPanel', () => {
  const answered: MemoryAskResponse = {
    answer: 'Prefers a morning call.', resolved: true, customer_id: 7, candidates: [],
    citations: [{ id: 1, kind: 'preference', summary: 'Asked for mornings', occurred_at: '2026-10-10T04:00:00+00:00' }],
    retrieval_mode: 'semantic',
  }

  it('counts characters, disables an empty question, and caps at 500', async () => {
    const user = userEvent.setup()
    render(<AskMemoryPanel customerId={7} copy={en} />)
    const ask = screen.getByRole('button', { name: 'Ask' })
    expect(ask).toBeDisabled()
    expect(screen.getByText('0 / 500')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Your question'), 'abc')
    expect(screen.getByText('3 / 500')).toBeInTheDocument()
    expect(ask).toBeEnabled()
    expect(screen.getByLabelText('Your question')).toHaveAttribute('maxlength', '500')
  })

  it('on a lead page it passes the customer_id; renders answer, citations and retrieval mode', async () => {
    mockAsk.mockResolvedValue(answered)
    const user = userEvent.setup()
    render(<AskMemoryPanel customerId={7} copy={en} />)
    await user.type(screen.getByLabelText('Your question'), '  When to call?  ')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(mockAsk).toHaveBeenCalledWith({ question: 'When to call?', customer_id: 7 })
    expect(await screen.findByText('Prefers a morning call.')).toBeInTheDocument()
    expect(screen.getByText('Prefers a morning call.')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Asked for mornings')).toBeInTheDocument()
    expect(screen.getByText('Retrieval: semantic')).toBeInTheDocument()
  })

  it('sends no customer_id when unscoped, and hides retrieval when it is null', async () => {
    mockAsk.mockResolvedValue({ ...answered, retrieval_mode: null, citations: [] })
    const user = userEvent.setup()
    render(<AskMemoryPanel copy={en} />)
    await user.type(screen.getByLabelText('Your question'), 'Who is Test A?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(mockAsk).toHaveBeenCalledWith({ question: 'Who is Test A?' })
    await screen.findByText(en.ask.noCitations)
    expect(screen.queryByText(/Retrieval:/)).not.toBeInTheDocument()
  })

  it('renders the answer as text, never as HTML', async () => {
    mockAsk.mockResolvedValue({ ...answered, answer: '<img src=x onerror=alert(1)> <b>bold</b>' })
    const user = userEvent.setup()
    const { container } = render(<AskMemoryPanel customerId={7} copy={en} />)
    await user.type(screen.getByLabelText('Your question'), 'q')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await screen.findByText(/<img src=x/)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('ambiguous: shows a candidate pick-list and re-asks the same question with the chosen customer_id', async () => {
    const candidates = [
      { customer_id: 1, name: 'Test Customer A', email: 'a@example.test', company: 'Example Co' },
      { customer_id: 2, name: 'Test Customer B', email: 'b@example.test', company: null },
    ]
    mockAsk.mockResolvedValueOnce({ answer: '', resolved: false, customer_id: null, candidates, citations: [], retrieval_mode: null })
    mockAsk.mockResolvedValueOnce(answered)
    const user = userEvent.setup()
    render(<AskMemoryPanel copy={en} />)
    await user.type(screen.getByLabelText('Your question'), 'What does Test want?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(en.ask.pickTitle)).toBeInTheDocument()
    expect(screen.getByText('Test Customer A')).toBeInTheDocument()
    expect(screen.getByText('a@example.test')).toBeInTheDocument()
    expect(screen.getByText('Example Co')).toBeInTheDocument()
    const picks = screen.getAllByRole('button', { name: en.ask.pick })
    expect(picks.length).toBe(2)
    await user.click(picks[1])
    expect(mockAsk).toHaveBeenLastCalledWith({ question: 'What does Test want?', customer_id: 2 })
    expect(await screen.findByText('Prefers a morning call.')).toBeInTheDocument()
    expect(screen.queryByText(en.ask.pickTitle)).not.toBeInTheDocument()
  })

  it('unresolved with no candidates: "No matching customer"', async () => {
    mockAsk.mockResolvedValue({ answer: '', resolved: false, customer_id: null, candidates: [], citations: [], retrieval_mode: null })
    const user = userEvent.setup()
    render(<AskMemoryPanel copy={en} />)
    await user.type(screen.getByLabelText('Your question'), 'q')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(en.ask.noMatch)).toBeInTheDocument()
    expect(screen.queryByText(en.ask.pickTitle)).not.toBeInTheDocument()
  })

  it('503 shows the agent error text with a retry that asks again', async () => {
    mockAsk.mockRejectedValueOnce(apiErr(503, 'The recall agent failed.'))
    mockAsk.mockResolvedValueOnce(answered)
    const user = userEvent.setup()
    render(<AskMemoryPanel customerId={7} copy={en} />)
    await user.type(screen.getByLabelText('Your question'), 'q')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(en.ask.errors.agent)
    expect(alert).toHaveTextContent('The recall agent failed.')
    await user.click(within(alert).getByRole('button', { name: en.common.retry }))
    expect(mockAsk).toHaveBeenCalledTimes(2)
    expect(mockAsk).toHaveBeenLastCalledWith({ question: 'q', customer_id: 7 })
    expect(await screen.findByText('Prefers a morning call.')).toBeInTheDocument()
    expect(screen.queryByText('The recall agent failed.')).not.toBeInTheDocument()
  })

  it.each([
    [403, "This customer's leads are assigned to another rep.", en.ask.errors.anotherRep],
    [403, 'Your role cannot query customer memory.', en.ask.errors.role],
    [404, 'Customer not found', en.ask.errors.notFound],
  ])('%i "%s" has no retry button', async (status, detail, message) => {
    mockAsk.mockRejectedValue(apiErr(status, detail))
    const user = userEvent.setup()
    render(<AskMemoryPanel customerId={7} copy={en} />)
    await user.type(screen.getByLabelText('Your question'), 'q')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })
})

// ── Customer memory ──────────────────────────────────────────────────────────

describe('CustomerMemoryPanel', () => {
  const customer = { customer_id: 7, name: 'Test Customer A', email: 'a@example.test', company: null }
  const profile = {
    summary: 'Interested in a rooftop system.', traits: ['careful'], open_questions: ['Budget?'], agent_notes: null,
    next_best_action: 'Send a datasheet', last_reflected_at: '2026-10-10T04:00:00+00:00', reflection_count: 2,
  }
  const memory = (id: number, over = {}) => ({
    id, kind: 'preference', source: 'reflection', summary: `Summary ${id}`, detail: null, tags: [], salience: 3,
    lead_id: 12, occurred_at: '2026-10-10T04:00:00+00:00', created_by: 'sales_agent', ...over,
  })
  const ok = (data: unknown) => ({ data, isLoading: false, isFetching: false, error: null, refetch: vi.fn() })

  it('shows the profile, the list and the "shown of total" count', () => {
    mockUseCustomerMemory.mockReturnValue(ok({ customer, profile, memory_count: 14, memories: [memory(1), memory(2)] }))
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    expect(screen.getByText('Interested in a rooftop system.')).toBeInTheDocument()
    expect(screen.getByText('careful')).toBeInTheDocument()
    expect(screen.getByText('Budget?')).toBeInTheDocument()
    expect(screen.getByText('Send a datasheet')).toBeInTheDocument()
    expect(screen.getByText(/10 Oct 2026.*IST/, { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('Showing 2 of 14 memories')).toBeInTheDocument()
    expect(screen.getByText('Summary 1')).toBeInTheDocument()
  })

  it('a null profile is an empty state, and an empty list says so', () => {
    mockUseCustomerMemory.mockReturnValue(ok({ customer, profile: null, memory_count: 0, memories: [] }))
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    expect(screen.getByText(en.memory.noProfile)).toBeInTheDocument()
    expect(screen.getByText(en.memory.empty)).toBeInTheDocument()
    expect(screen.getByText('Showing 0 of 0 memories')).toBeInTheDocument()
  })

  it('shows null next_best_action as "none recorded", not blank', () => {
    mockUseCustomerMemory.mockReturnValue(ok({ customer, profile: { ...profile, next_best_action: null, traits: [] }, memory_count: 0, memories: [] }))
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    expect(screen.getAllByText(en.memory.noValue).length).toBeGreaterThanOrEqual(2)
  })

  it('renders every memory field as plain text, never HTML', () => {
    const evil = '<script>window.__pwned = 1</script><img src=x onerror=alert(1)>'
    mockUseCustomerMemory.mockReturnValue(ok({
      customer,
      profile: { ...profile, summary: evil, traits: [evil], open_questions: [evil], next_best_action: evil },
      memory_count: 1,
      memories: [memory(1, { summary: evil, detail: evil, tags: [evil], source: evil })],
    }))
    const { container } = render(<CustomerMemoryPanel customerId={7} copy={en} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getAllByText(/<script>/).length).toBeGreaterThanOrEqual(5)
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it('an unknown kind from the server is shown as it is', () => {
    mockUseCustomerMemory.mockReturnValue(ok({ customer, profile: null, memory_count: 1, memories: [memory(1, { kind: 'mystery' })] }))
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })

  it('the kind filter and the limit go to the request', async () => {
    mockUseCustomerMemory.mockReturnValue(ok({ customer, profile: null, memory_count: 0, memories: [] }))
    const user = userEvent.setup()
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    expect(mockUseCustomerMemory).toHaveBeenLastCalledWith(7, { kind: undefined, limit: 100 })
    await user.selectOptions(screen.getByLabelText('Kind'), 'objection')
    expect(mockUseCustomerMemory).toHaveBeenLastCalledWith(7, { kind: 'objection', limit: 100 })
    const limit = screen.getByLabelText('Show up to')
    await user.clear(limit)
    await user.type(limit, '9999')
    await waitFor(() => expect(mockUseCustomerMemory).toHaveBeenLastCalledWith(7, { kind: 'objection', limit: 500 }))
    expect(limit).toHaveAttribute('min', '1')
    expect(limit).toHaveAttribute('max', '500')
  })

  it('shows a loading state', () => {
    mockUseCustomerMemory.mockReturnValue({ data: undefined, isLoading: true, isFetching: true, error: null, refetch: vi.fn() })
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    expect(screen.getByRole('status', { name: en.memory.loading })).toBeInTheDocument()
  })

  it.each([
    [403, 'Your role cannot query customer memory.', en.memory.errors.role, false],
    [403, "This customer's leads are assigned to another rep.", en.memory.errors.anotherRep, false],
    [404, 'Customer not found', en.memory.errors.notFound, false],
    [422, "Unknown memory kind: 'x'", en.memory.errors.unknownKind, false],
    [500, 'boom', en.memory.errors.generic, true],
  ])('%i "%s" → message, retry=%s', (status, detail, message, retry) => {
    mockUseCustomerMemory.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, error: apiErr(status, detail), refetch: vi.fn() })
    render(<CustomerMemoryPanel customerId={7} copy={en} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(!!within(alert).queryByRole('button')).toBe(retry)
  })
})
