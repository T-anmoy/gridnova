import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import NetworkCommandCentre from '@/components/dashboard/NetworkCommandCentre'
import { associateGroupLabel, associateRows, fillPercent, overdueItems, stageRows } from '@/lib/commissions/network'
import { ApiError } from '@/lib/dashboard/api-error'
import { NETWORK_SUMMARY } from './fixtures/commissions-contract'
import { navState } from './helpers/mock-navigation'

const h = vi.hoisted(() => ({
  role: { role: 'admin' as string | undefined, isLoaded: true },
  summary: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  params: vi.fn(),
}))
vi.mock('@/lib/dashboard/use-staff-role', () => ({ useStaffRole: () => h.role }))
vi.mock('@/lib/commissions/staff-api-client', () => ({
  useNetworkSummary: (p: unknown) => (h.params(p), { refetch: vi.fn(), isFetching: false, ...h.summary }),
}))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

beforeEach(() => {
  vi.clearAllMocks()
  navState.reset('/dashboard/network')
  h.role = { role: 'admin', isLoaded: true }
  h.summary = { data: NETWORK_SUMMARY }
})

describe('Network Command Centre — role visibility (E11)', () => {
  it('Admin and Management see it', () => {
    for (const role of ['admin', 'management']) {
      h.role = { role, isLoaded: true }
      const { unmount } = render(<NetworkCommandCentre />)
      expect(screen.getByRole('heading', { name: 'Network Command Centre' }), role).toBeInTheDocument()
      unmount()
    }
  })

  it('every other role gets a no-access page and the endpoint is never called', () => {
    for (const role of ['accounts', 'sales', 'engineer', 'operations']) {
      h.role = { role, isLoaded: true }
      h.params.mockClear()
      const { unmount } = render(<NetworkCommandCentre />)
      expect(screen.getByTestId('no-access'), role).toBeInTheDocument()
      expect(h.params, role).not.toHaveBeenCalled()
      unmount()
    }
  })
})

describe('Network Command Centre — numbers come from the endpoint', () => {
  it('shows verified revenue and commissions as the server’s strings', () => {
    render(<NetworkCommandCentre />)
    expect(within(screen.getByTestId('revenue')).getAllByText('₹21,780.00', { selector: 'dd' })).toHaveLength(2) // credits and net
    const money = screen.getByTestId('commission-money')
    expect(money).toHaveTextContent('₹1,600.00')
    expect(money).toHaveTextContent('Paid (net)')
  })

  it('shows a negative reversed figure in red', () => {
    h.summary = { data: { ...NETWORK_SUMMARY, commissions: { ...NETWORK_SUMMARY.commissions, reversed: '-1000.00' } } }
    render(<NetworkCommandCentre />)
    expect(within(screen.getByTestId('commission-money')).getByText('-₹1,000.00')).toHaveClass('text-red-700')
  })

  it('states the period the money covers, in IST', () => {
    render(<NetworkCommandCentre />)
    expect(screen.getByTestId('period')).toHaveTextContent('01 Oct 2026 – 13 Oct 2026')
  })

  it('sends the chosen period to the endpoint', () => {
    navState.reset('/dashboard/network', 'from=2026-09-01&to=2026-09-30')
    render(<NetworkCommandCentre />)
    expect(h.params).toHaveBeenCalledWith({ date_from: '2026-09-01', date_to: '2026-09-30' })
  })

  it('lists the funnel and associate numbers in accessible tables behind the charts', async () => {
    render(<NetworkCommandCentre />)
    const funnel = await screen.findByRole('table', { name: 'Active onboardings by current stage', hidden: true })
    expect(within(funnel).getByRole('row', { name: /Installed 3/, hidden: true })).toBeInTheDocument()
    const assoc = await screen.findByRole('table', { name: 'Associates by type and status', hidden: true })
    expect(within(assoc).getByRole('row', { name: /Associate · Sales 7 0 7/, hidden: true })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /Active customer onboardings by current stage/ }).length).toBeGreaterThan(0)
  })

  it('shows seat fill as labelled meters', () => {
    render(<NetworkCommandCentre />)
    const card = screen.getByTestId('seat-card')
    expect(within(card).getByText('West Bengal')).toBeInTheDocument()
    const heads = within(card).getByRole('meter', { name: 'State Heads' })
    expect(heads).toHaveAttribute('aria-valuenow', '1')
    expect(heads).toHaveAttribute('aria-valuemax', '2')
    expect(within(card).getByRole('meter', { name: 'Blocks with an associate' })).toHaveAttribute('aria-valuetext', '1 of 345')
  })
})

describe('Network Command Centre — overdue items link to their queues (E11)', () => {
  it('links each overdue counter to the queue it lives in', () => {
    render(<NetworkCommandCentre />)
    expect(screen.getByTestId('overdue-verification_calls')).toHaveAttribute('href', '/dashboard/onboardings?attention=1')
    expect(screen.getByTestId('overdue-survey_reviews')).toHaveAttribute('href', '/dashboard/survey-reviews')
    expect(screen.getByTestId('overdue-payments_awaiting_verification')).toHaveAttribute('href', '/dashboard/accounts')
    expect(screen.getByTestId('overdue-commission_queries')).toHaveAttribute('href', '/dashboard/commissions/queries?overdue=1')
    expect(screen.getByTestId('overdue-commission_queries')).toHaveTextContent('4')
  })

  it('links the waiting-for-a-rate count to the filtered commission list', () => {
    h.summary = { data: { ...NETWORK_SUMMARY, commissions: { ...NETWORK_SUMMARY.commissions, pending_count: 3 } } }
    render(<NetworkCommandCentre />)
    expect(screen.getByRole('link', { name: /3 earnings are waiting for a rate/ })).toHaveAttribute('href', '/dashboard/commissions?pending=1')
  })
})

describe('Network Command Centre — failure states are honest', () => {
  it('an unreachable backend is an error card, not zeroes', () => {
    h.summary = { error: new ApiError(0, 'Network request failed') }
    render(<NetworkCommandCentre />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Can’t reach the server/)
    expect(screen.queryByTestId('overdue-list')).toBeNull()
  })

  it('explains an invalid period instead of a raw error', () => {
    h.summary = { error: new ApiError(422, 'x', 'bad period', { code: 'invalid_period' }) }
    render(<NetworkCommandCentre />)
    expect(screen.getByRole('alert')).toHaveTextContent(/no more than 366 days/)
  })
})

describe('network helpers', () => {
  it('labels associate groups', () => {
    expect(associateGroupLabel({ associate_type: 'preferred_associate', level: 'state_head' })).toBe('Preferred Associate · State Head')
    expect(associateGroupLabel({ associate_type: 'associate', capability: 'execution' })).toBe('Associate · Execution')
    expect(associateGroupLabel({ associate_type: 'something_new' })).toBe('Something new')
  })

  it('groups counts by status without losing any', () => {
    const { rows, statuses } = associateRows([
      { associate_type: 'associate', capability: 'sales', level: null, status: 'active', count: 7 },
      { associate_type: 'associate', capability: 'sales', level: null, status: 'suspended', count: 2 },
      { associate_type: 'preferred_associate', capability: null, level: 'block', status: 'active', count: 1 },
    ])
    expect(statuses).toEqual(['active', 'suspended'])
    expect(rows).toEqual([
      { name: 'Associate · Sales', total: 9, byStatus: { active: 7, suspended: 2 } },
      { name: 'Preferred Associate · Block', total: 1, byStatus: { active: 1 } },
    ])
  })

  it('keeps the funnel order the endpoint sent', () => {
    expect(stageRows({ agreement_signed: 1, installed: 3 }).map((r) => r.stage)).toEqual(['agreement_signed', 'installed'])
  })

  it('fill percent is a whole number and never NaN', () => {
    expect(fillPercent(1, 2)).toBe(50)
    expect(fillPercent(1, 345)).toBe(0)
    expect(fillPercent(0, 0)).toBe(0)
    expect(fillPercent(9, 3)).toBe(100)
  })

  it('does not link a queue the role cannot open', () => {
    const items = overdueItems(NETWORK_SUMMARY.overdue, 'engineer')
    expect(items.find((i) => i.key === 'commission_queries')!.href).toBeNull()
  })
})
