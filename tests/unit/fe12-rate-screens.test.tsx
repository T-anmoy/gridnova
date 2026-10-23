import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssociateRateCard from '@/components/dashboard/associate-network/AssociateRateCard'
import AssociatePerformancePanel from '@/components/dashboard/associate-network/AssociatePerformancePanel'
import RateSchedules from '@/components/dashboard/commissions/RateSchedules'
import MyRateCard from '@/components/associate/MyRateCard'
import PortalEarnings from '@/components/associate/PortalEarnings'
import EstimatedCommissionNote from '@/components/associate/EstimatedCommissionNote'
import { describeTodo, todoHref } from '@/lib/onboarding/todo'
import { ApiError } from '@/lib/dashboard/api-error'
import { I18nProvider } from '@/lib/i18n/client'
import { en } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { RATE, PERFORMANCE, MY_RATE } from './fixtures/individual-rate-contract'
import { ASSOCIATE_COMMISSIONS, RATE_SCHEDULES, makeEntry } from './fixtures/commissions-contract'

const h = vi.hoisted(() => ({
  role: { role: 'admin' as string | undefined, isLoaded: true },
  rate: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  save: vi.fn(),
  perf: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  perfRange: vi.fn(),
  schedules: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  mine: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  commissions: {} as { data?: unknown },
}))
vi.mock('@/lib/dashboard/use-staff-role', () => ({ useStaffRole: () => h.role }))
vi.mock('@/lib/commissions/staff-api-client', () => ({
  useAssociateRate: () => ({ refetch: vi.fn(), ...h.rate }),
  useSetAssociateRate: () => ({ mutateAsync: h.save, isPending: false }),
  useAssociatePerformance: (_id: string, range: unknown) => (h.perfRange(range), { refetch: vi.fn(), ...h.perf }),
  useRateSchedules: () => ({ refetch: vi.fn(), ...h.schedules }),
  usePublishRateSchedule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReRate: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/lib/commissions/associate-api-client', () => ({
  useMyRate: () => ({ ...h.mine }),
  useMyCommissions: () => ({ refetch: vi.fn(), isFetching: false, ...h.commissions }),
  useMyPayouts: () => ({ data: { items: [] } }),
  useEntryQueries: () => ({ data: { items: [] } }),
  useRaiseCommissionQuery: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/associates/portal/earnings',
}))

beforeEach(() => {
  vi.clearAllMocks()
  h.role = { role: 'admin', isLoaded: true }
  h.rate = { data: RATE }
  h.perf = { data: PERFORMANCE }
  h.schedules = { data: RATE_SCHEDULES }
  h.mine = { data: MY_RATE }
  h.commissions = { data: { ...ASSOCIATE_COMMISSIONS, items: [], total: 0 } }
})

describe('Admin card — what everyone allowed to read sees', () => {
  it('shows the standard rate, the individual rate, the rate in effect, the scheduled change and the history', () => {
    render(<AssociateRateCard associateId="GNA-WB-26-00007" canEdit />)
    expect(screen.getByTestId('rate-standard')).toHaveTextContent('7.5%')
    expect(screen.getByTestId('rate-individual')).toHaveTextContent('8%')
    expect(screen.getByTestId('rate-effective')).toHaveTextContent('8%')
    expect(screen.getByTestId('rate-source-tag')).toHaveTextContent('Individual rate')
    expect(screen.getByTestId('rate-scheduled')).toHaveTextContent('From 07 Nov 2026: 7.5% (standard)')
    const rows = screen.getAllByTestId('rate-history-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('07 Nov 2026')
    expect(rows[0]).toHaveTextContent('8% → Standard rate')
    expect(rows[0]).toHaveTextContent('Set by emp-admin-1 · Quarterly review: back to standard')
    expect(rows[1]).toHaveTextContent('Standard rate → 8%')
    expect(screen.getByText('Associate — sales', { exact: false })).toBeInTheDocument()
  })

  it('Management can read it but gets no buttons', () => {
    h.role = { role: 'management', isLoaded: true }
    render(<AssociateRateCard associateId="GNA-WB-26-00007" canEdit={false} />)
    expect(screen.getByTestId('rate-effective')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change rate/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /return to standard/i })).toBeNull()
    expect(screen.getByTestId('rate-readonly')).toBeInTheDocument()
  })

  it('a 403 from the server hides the card entirely', () => {
    h.rate = { error: new ApiError(403, 'Forbidden', 'Forbidden') }
    const { container } = render(<AssociateRateCard associateId="GNA-WB-26-00007" canEdit={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('"Return to standard rate" is offered only while an individual rate is in force', () => {
    h.rate = { data: { ...RATE, individual: null, effective: { ...RATE.effective, source: 'standard', rate_percent: '7.5000' } } }
    render(<AssociateRateCard associateId="x" canEdit />)
    expect(screen.queryByRole('button', { name: /return to standard/i })).toBeNull()
    expect(screen.getByTestId('rate-individual')).toHaveTextContent('None')
  })

  it('states the notice rule from the response, never from a constant', () => {
    render(<AssociateRateCard associateId="x" canEdit />)
    expect(screen.getByTestId('notice-rule')).toHaveTextContent('A higher rate can start from 23 Oct 2026. A lower rate needs 15 days’ notice (earliest 07 Nov 2026).')
  })
})

describe('Admin card — changing the rate', () => {
  const open = async () => {
    const user = userEvent.setup()
    render(<AssociateRateCard associateId="GNA-WB-26-00007" canEdit />)
    await user.click(screen.getByRole('button', { name: 'Change rate' }))
    return user
  }
  const rateField = () => screen.getByLabelText(/New rate/)
  const dateField = () => screen.getByLabelText('Starts on') as HTMLInputElement

  it('starts from the rate in effect; the stepper moves it by a quarter either way', async () => {
    const user = await open()
    expect(rateField()).toHaveValue('8')
    await user.click(screen.getByRole('button', { name: 'Raise by 0.25' }))
    expect(rateField()).toHaveValue('8.25')
    await user.click(screen.getByRole('button', { name: 'Lower by 0.25' }))
    await user.click(screen.getByRole('button', { name: 'Lower by 0.25' }))
    expect(rateField()).toHaveValue('7.75')
  })

  it('the minimum date follows the direction: today for an increase, today + notice for a reduction', async () => {
    const user = await open()
    expect(dateField().min).toBe('2026-10-23')
    await user.click(screen.getByRole('button', { name: 'Lower by 0.25' }))
    expect(dateField().min).toBe('2026-11-07')
    expect(dateField().value).toBe('2026-11-07')
    expect(screen.getByTestId('date-hint')).toHaveTextContent('15 days')
    await user.click(screen.getByRole('button', { name: 'Raise by 0.25' }))
    await user.click(screen.getByRole('button', { name: 'Raise by 0.25' }))
    expect(dateField().min).toBe('2026-10-23')
    expect(dateField().value).toBe('2026-10-23')
  })

  it('a typed value works the same as the stepper', async () => {
    const user = await open()
    await user.clear(rateField())
    await user.type(rateField(), '6.5')
    expect(dateField().min).toBe('2026-11-07')
  })

  it('checks the form locally and focuses the first problem', async () => {
    const user = await open()
    await user.clear(rateField())
    await user.type(rateField(), '101')
    await user.click(screen.getByRole('button', { name: /review change/i }))
    expect(screen.getByText(/between 0 and 100/)).toBeInTheDocument()
    expect(rateField()).toHaveFocus()
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2) // the rate and the missing reason
    expect(h.save).not.toHaveBeenCalled()
  })

  it('the confirm step states old → new, the date and what the date means, then sends the rate as a string', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Raise by 0.25' }))
    await user.type(screen.getByLabelText(/Reason/), 'Twelve installs this quarter')
    await user.click(screen.getByRole('button', { name: /review change/i }))
    expect(screen.getByTestId('confirm-change')).toHaveTextContent('Rate changes from 8% to 8.25% from 23 Oct 2026.')
    expect(screen.getByTestId('confirm-explain')).toHaveTextContent('agreement is signed on or after 23 Oct 2026')
    expect(screen.getByTestId('confirm-explain')).toHaveTextContent('Commission already recorded never changes')
    h.save.mockResolvedValue({})
    await user.click(screen.getByRole('button', { name: 'Confirm rate change' }))
    await waitFor(() => expect(h.save).toHaveBeenCalled())
    expect(h.save).toHaveBeenCalledWith({ rate_percent: '8.25', effective_from: '2026-10-23', reason: 'Twelve installs this quarter' })
    expect(typeof h.save.mock.calls[0][0].rate_percent).toBe('string')
    expect(await screen.findByTestId('rate-saved')).toHaveTextContent('Saved: Rate changes from 8% to 8.25%')
  })

  it.each([
    ['notice_period', 'effective_from', { earliest_effective_from: '2026-11-07' }, /notice period.*07 Nov 2026/],
    ['effective_in_past', 'effective_from', { earliest_effective_from: '2026-10-23' }, /That date has passed/],
    ['invalid_rate', 'rate_percent', {}, /between 0 and 100/],
    ['out_of_bounds', 'rate_percent', { min_percent: '2.0000', max_percent: '10.0000' }, /between 2% and 10%/],
    ['reason_required', 'reason', {}, /at least 10 characters/],
  ])('the server’s %s refusal comes back in plain words beside its field', async (code, field, extra, message) => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Raise by 0.25' }))
    await user.type(screen.getByLabelText(/Reason/), 'Twelve installs this quarter')
    await user.click(screen.getByRole('button', { name: /review change/i }))
    h.save.mockRejectedValue(new ApiError(422, 'x', undefined, { code, message: 'Raw English', field, ...extra }))
    await user.click(screen.getByRole('button', { name: 'Confirm rate change' }))
    const alert = await screen.findByText(message)
    expect(alert).toHaveAttribute('role', 'alert')
    expect(screen.queryByText('Raw English')).toBeNull()
    expect(screen.getByRole('button', { name: /review change/i })).toBeInTheDocument() // back on the form
  })

  it('"Return to standard rate" sends null and names the standard rate', async () => {
    const user = userEvent.setup()
    render(<AssociateRateCard associateId="GNA-WB-26-00007" canEdit />)
    await user.click(screen.getByRole('button', { name: 'Return to standard rate' }))
    expect(screen.getByTestId('standard-note')).toHaveTextContent('now 7.5%')
    expect(screen.queryByLabelText(/New rate/)).toBeNull()
    expect(dateField().min).toBe('2026-11-07') // 7.5 is lower than 8
    await user.type(screen.getByLabelText(/Reason/), 'Quarterly review: back to standard')
    await user.click(screen.getByRole('button', { name: /review change/i }))
    expect(screen.getByTestId('confirm-change')).toHaveTextContent('Rate changes from 8% to the standard rate (7.5%) from 07 Nov 2026.')
    h.save.mockResolvedValue({})
    await user.click(screen.getByRole('button', { name: 'Confirm rate change' }))
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ rate_percent: null, effective_from: '2026-11-07', reason: 'Quarterly review: back to standard' }))
  })
})

describe('Performance panel', () => {
  it('shows the BE-12 figures and no installed-capacity figure', () => {
    render(<AssociatePerformancePanel associateId="GNA-WB-26-00007" />)
    expect(screen.getByTestId('perf-onboarded')).toHaveTextContent('4')
    expect(screen.getByTestId('perf-verified')).toHaveTextContent('3')
    expect(screen.getByTestId('perf-commissioned')).toHaveTextContent('1')
    expect(screen.getByTestId('perf-payments')).toHaveTextContent('₹87,120.00')
    expect(screen.getByTestId('perf-earned')).toHaveTextContent('₹4,000.00')
    expect(screen.getByTestId('performance-period')).toHaveTextContent('01 Oct 2026 to 23 Oct 2026')
    expect(screen.getByTestId('performance-panel').textContent).not.toMatch(/\bkW\b|capacity/i)
  })

  it('with no dates the server’s default (this month) is used; a full range is sent as both dates', () => {
    render(<AssociatePerformancePanel associateId="x" />)
    expect(h.perfRange).toHaveBeenLastCalledWith({})
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-01' } })
    expect(h.perfRange).toHaveBeenLastCalledWith({})
    expect(screen.getByTestId('range-problem')).toHaveTextContent('both dates')
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-30' } })
    expect(h.perfRange).toHaveBeenLastCalledWith({ date_from: '2026-07-01', date_to: '2026-09-30' })
    expect(screen.queryByTestId('range-problem')).toBeNull()
  })

  it('a period over 366 days is refused before the request', () => {
    render(<AssociatePerformancePanel associateId="x" />)
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } })
    expect(screen.getByTestId('range-problem')).toHaveTextContent('366')
    expect(h.perfRange).toHaveBeenLastCalledWith({})
  })
})

describe('Rate schedules page (admin)', () => {
  it('labels both Associate lines and the other keys in plain English', () => {
    render(<RateSchedules />)
    for (const label of ['Associate — sales', 'Associate — execution', 'Preferred Associate — State Head', 'Preferred Associate — District Head', 'Preferred Associate — Block', 'Territory — State', 'Territory — District', 'Territory — Block'])
      expect(screen.getAllByText(label).length, label).toBeGreaterThan(0)
    expect(screen.getByTestId('associate-keys-note')).toHaveTextContent('both Associate lines')
  })

  it('shows the 15-day wording once a real schedule exists', () => {
    h.schedules = { data: { ...RATE_SCHEDULES, next_real_schedule_is_first: false } }
    render(<RateSchedules />)
    expect(screen.getByTestId('notice-hint')).toHaveTextContent('Earliest allowed: 29 Oct 2026 (the notice period).')
  })

  it('says "This first schedule can take effect today" while none has ever been published', () => {
    h.schedules = {
      data: { ...RATE_SCHEDULES, items: RATE_SCHEDULES.items.filter((s) => s.is_placeholder), in_force_schedule_id: null, earliest_effective_from: '2026-10-23', next_real_schedule_is_first: true },
    }
    render(<RateSchedules />)
    expect(screen.getByTestId('notice-hint')).toHaveTextContent('This first schedule can take effect today (23 Oct 2026) or later.')
    expect(screen.getByTestId('notice-hint')).not.toHaveTextContent(/notice period/)
    expect((screen.getByLabelText(/Effective from/) as HTMLInputElement).min).toBe('2026-10-23')
  })
})

const renderIn = (locale: 'en' | 'hi' | 'bn', ui: React.ReactNode) =>
  render(<I18nProvider locale={locale} messages={{ en, hi, bn }[locale] as typeof en}>{ui}</I18nProvider>)

describe('Associate portal — “Your commission rate”', () => {
  it('individual rate with an upcoming change', () => {
    renderIn('en', <MyRateCard />)
    expect(screen.getByTestId('my-rate-value')).toHaveTextContent('8%')
    expect(screen.getByTestId('my-rate-source')).toHaveTextContent('Your individual rate')
    expect(screen.getByTestId('my-rate-card')).toHaveTextContent('Applies to agreements signed from 23 Oct 2026.')
    expect(screen.getByTestId('my-rate-card')).toHaveTextContent('Commission already recorded does not change.')
    expect(screen.getByTestId('my-rate-upcoming')).toHaveTextContent('From 07 Nov 2026: 7.5% (standard rate)')
  })

  it('standard rate, nothing scheduled', () => {
    h.mine = { data: { ...MY_RATE, effective: { ...MY_RATE.effective, source: 'standard', rate_percent: '7.5000' }, scheduled_changes: [] } }
    renderIn('en', <MyRateCard />)
    expect(screen.getByTestId('my-rate-source')).toHaveTextContent('Standard rate')
    expect(screen.queryByTestId('my-rate-upcoming')).toBeNull()
  })

  it('no confirmed rate yet says Grid Nova will confirm it', () => {
    h.mine = { data: { ...MY_RATE, effective: { rate_percent: null, source: null, effective_from: null, pending_reason: 'placeholder_rates' }, scheduled_changes: [] } }
    renderIn('en', <MyRateCard />)
    expect(screen.getByTestId('my-rate-pending')).toHaveTextContent('Grid Nova will confirm your commission rate.')
    expect(screen.queryByTestId('my-rate-value')).toBeNull()
  })

  it('a scheduled change to “no confirmed rate” is not shown as a number', () => {
    h.mine = { data: { ...MY_RATE, scheduled_changes: [{ effective_from: '2026-11-07', rate_percent: null, source: null }] } }
    renderIn('en', <MyRateCard />)
    expect(screen.getByTestId('my-rate-upcoming')).toHaveTextContent('From 07 Nov 2026: rate to be confirmed')
  })

  it.each([['hi', hi], ['bn', bn]] as const)('is translated in %s, with the rate and date formatted', (lang, messages) => {
    renderIn(lang, <MyRateCard />)
    const copy = messages.portalEase.rate
    expect(screen.getByRole('heading', { name: copy.title })).toBeInTheDocument()
    expect(screen.getByTestId('my-rate-source')).toHaveTextContent(copy.individual)
    expect(screen.getByTestId('my-rate-value')).toHaveTextContent('8%')
    expect(screen.getByTestId('my-rate-upcoming')).toHaveTextContent(copy.upcomingTitle)
    expect(screen.getByTestId('my-rate-card').textContent).not.toMatch(/Applies to agreements|Commission already recorded/)
  })

  it('never shows an internal reason, even if one reached the browser', () => {
    h.mine = { data: { ...MY_RATE, reason: 'Twelve installs this quarter', set_by: 'emp-admin-1' } }
    renderIn('en', <MyRateCard />)
    expect(screen.getByTestId('my-rate-card').textContent).not.toMatch(/Twelve installs|emp-admin/)
  })

  it('is left out when the rate cannot be read, and while loading it says so', () => {
    h.mine = { error: new ApiError(500, 'x') }
    const { container, rerender } = renderIn('en', <MyRateCard />)
    expect(container).toBeEmptyDOMElement()
    h.mine = { isLoading: true }
    rerender(<I18nProvider locale="en" messages={en}><MyRateCard /></I18nProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your commission rate')
  })

  it('sits on the Earnings page', () => {
    renderIn('en', <PortalEarnings copy={en.associates.portal.earnings} policyHref="/commission-policy" />)
    expect(screen.getByTestId('my-rate-card')).toBeInTheDocument()
  })

  it('earnings entries and estimates rated at an individual rate carry the tag', () => {
    h.commissions = { data: { ...ASSOCIATE_COMMISSIONS, items: [makeEntry({ rate_source: 'individual' }), makeEntry({ entry_id: 13, rate_source: 'standard' })], total: 2 } }
    renderIn('en', <PortalEarnings copy={en.associates.portal.earnings} policyHref="/commission-policy" />)
    expect(screen.getAllByTestId('individual-rate-tag')).toHaveLength(1)
    expect(screen.getByTestId('individual-rate-tag')).toHaveTextContent('Individual rate')
    renderIn('en', <EstimatedCommissionNote value={{ amount: '1000.00', rate: '8.0000', basis: 'accepted_proposal', value_used: '1', basis_amount: '1', pending_reason: null, rate_source: 'individual' }} />)
    expect(screen.getAllByTestId('individual-rate-tag').length).toBeGreaterThan(1)
  })
})

describe('Home feed — commission_rate_changed', () => {
  const item = (params: Record<string, unknown>) => ({
    kind: 'commission_rate_changed',
    message_key: 'todo.commission_rate_changed',
    priority: 3 as const,
    onboarding_id: null,
    customer_name: null,
    params,
  })
  const feed = en.associates.portal.feed

  it('turns the contract example into a sentence in the viewer’s language', () => {
    const p = { rate_percent_from: '8.0000', rate_percent_to: '7.5000', effective_from: '2026-11-07', scheduled: true }
    expect(describeTodo(item(p), feed, {})).toBe('Your commission rate changes from 8% to 7.5% from 07 Nov 2026.')
    expect(describeTodo(item(p), hi.associates.portal.feed as typeof feed, {})).toBe('आपकी कमीशन दर 07 Nov 2026 से 8% से बदलकर 7.5% हो जाएगी।')
    expect(describeTodo(item(p), bn.associates.portal.feed as typeof feed, {})).toContain('7.5%')
  })

  it('handles “no confirmed rate” on either side', () => {
    expect(describeTodo(item({ rate_percent_from: null, rate_percent_to: '7.5000', effective_from: '2026-11-07' }), feed, {})).toBe('Your commission rate is 7.5% from 07 Nov 2026.')
    expect(describeTodo(item({ rate_percent_from: '8.0000', rate_percent_to: null, effective_from: '2026-11-07' }), feed, {})).toBe('From 07 Nov 2026, Grid Nova will confirm your commission rate (now 8%).')
  })

  it('links to the Earnings page and has a title', () => {
    expect(todoHref(item({}), '/associates/portal')).toBe('/associates/portal/earnings')
    expect(feed.titles.commission_rate_changed).toBeTruthy()
  })
})
