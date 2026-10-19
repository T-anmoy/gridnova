import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortalEarnings from '@/components/associate/PortalEarnings'
import { ApiError } from '@/lib/dashboard/api-error'
import { en, withI18n } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import {
  ASSOCIATE_COMMISSIONS,
  ASSOCIATE_PAYOUTS,
  PENDING_ENTRY,
  RECOVERY_ENTRY,
  REVERSAL_ENTRY,
  TERRITORY_ENTRY,
  makeEntry,
  makeQuery,
} from './fixtures/commissions-contract'

const copy = en.associates.portal.earnings

const hooks = vi.hoisted(() => ({
  commissions: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  payouts: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  queries: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  raise: vi.fn(),
  params: vi.fn(),
  search: '',
}))
vi.mock('@/lib/commissions/associate-api-client', () => ({
  useMyCommissions: (p: unknown) => {
    hooks.params(p)
    return { refetch: vi.fn(), isFetching: false, ...hooks.commissions }
  },
  useMyPayouts: () => ({ refetch: vi.fn(), ...hooks.payouts }),
  useEntryQueries: () => ({ ...hooks.queries }),
  useRaiseCommissionQuery: () => ({ mutateAsync: hooks.raise, isPending: false }),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(hooks.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/associates/portal/earnings',
}))

const listWith = (items: unknown[], over: Record<string, unknown> = {}) => ({
  data: { ...ASSOCIATE_COMMISSIONS, items, total: items.length, ...over },
})
const withQuery = (e: ReturnType<typeof makeEntry>, q = { open: false, window_closes_at: '2099-01-01T00:00:00Z' }) => ({ ...e, query: q })

function renderPage(c = copy) {
  return render(withI18n(<PortalEarnings copy={c} policyHref="/commission-policy" />))
}

beforeEach(() => {
  vi.clearAllMocks()
  hooks.search = ''
  hooks.commissions = listWith([withQuery(makeEntry())])
  hooks.payouts = { data: ASSOCIATE_PAYOUTS }
  hooks.queries = { data: { items: [] } }
})

describe('Earnings summary (E1)', () => {
  it('formats the server’s decimal strings as ₹ and shows FY TDS and the next payout', () => {
    renderPage()
    const tiles = screen.getByTestId('earnings-tiles')
    expect(within(screen.getByTestId('tile-earned')).getByText('₹1,000.00')).toBeInTheDocument()
    expect(within(screen.getByTestId('tile-approved')).getByText('₹2,500.50')).toBeInTheDocument()
    expect(within(screen.getByTestId('tile-paid')).getByText('₹12,345.67')).toBeInTheDocument()
    expect(within(tiles).getByText(/TDS deducted in 2026-27/)).toBeInTheDocument()
    expect(within(screen.getByTestId('tile-tds')).getByText('₹300.00')).toBeInTheDocument()
    expect(within(screen.getByTestId('tile-recover')).getByText('₹250.50')).toBeInTheDocument()
    expect(screen.getByTestId('tile-next-payout')).toHaveTextContent('2026-10, expected by 10 Nov 2026')
  })

  it('never builds a number from money: a 17-digit amount keeps every digit', () => {
    hooks.commissions = listWith([withQuery(makeEntry({ amount: '12345678901234567.89' }))], {
      summary: { ...ASSOCIATE_COMMISSIONS.summary, earned: '12345678901234567.89' },
    })
    renderPage()
    expect(within(screen.getByTestId('tile-earned')).getByText('₹12,34,56,78,90,12,34,567.89')).toBeInTheDocument()
  })

  it('links to the Commission & Payout Policy (E6)', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Commission & Payout Policy/ })).toHaveAttribute('href', '/commission-policy')
  })
})

describe('Entries (E1, E4)', () => {
  it('only the Preferred portal says territory earnings appear too', () => {
    const { unmount } = renderPage()
    expect(screen.queryByTestId('territory-note')).toBeNull()
    unmount()
    render(withI18n(<PortalEarnings copy={copy} policyHref="/commission-policy" territory />))
    expect(screen.getByTestId('territory-note')).toHaveTextContent('Earnings from your territory appear here too.')
  })

  it('shows reversals and recoveries as negative, labelled rows', () => {
    hooks.commissions = listWith([withQuery(makeEntry()), withQuery(REVERSAL_ENTRY), withQuery(RECOVERY_ENTRY)])
    renderPage()
    const rows = screen.getAllByTestId('earning-entry')
    expect(rows).toHaveLength(3)
    const reversal = rows[1]
    expect(reversal).toHaveAttribute('data-kind', 'reversal')
    expect(within(reversal).getByTestId('entry-amount')).toHaveTextContent('-₹1,000.00')
    expect(reversal.querySelector('[data-negative="true"]')).not.toBeNull()
    expect(within(reversal).getByTestId('deduction-chip')).toHaveTextContent('Reversal')
    expect(within(reversal).getByText('Reverses earning #12')).toBeInTheDocument()
    expect(within(rows[2]).getByTestId('deduction-chip')).toHaveTextContent('Recovery')
    expect(within(rows[2]).getByTestId('entry-amount')).toHaveTextContent('-₹250.50')
    // a normal earning is neither
    expect(within(rows[0]).queryByTestId('deduction-chip')).toBeNull()
    expect(rows[0].querySelector('[data-negative="true"]')).toBeNull()
  })

  it('a pending rate says “Rate to be published” and shows no amount or rate', () => {
    hooks.commissions = listWith([withQuery(PENDING_ENTRY)])
    renderPage()
    const row = screen.getByTestId('earning-entry')
    expect(within(row).getByTestId('rate-pending')).toHaveTextContent('Rate to be published')
    expect(within(row).getByText(/Waiting for Grid Nova to publish the commission rates/)).toBeInTheDocument()
    expect(within(row).queryByTestId('entry-amount')).toBeNull()
    expect(row.textContent).not.toMatch(/₹0|0\.00%|NaN/)
  })

  it('names the territory role and the equal share', () => {
    hooks.commissions = listWith([withQuery(TERRITORY_ENTRY)])
    renderPage()
    expect(screen.getByText('District territory')).toBeInTheDocument()
    expect(screen.getByText('Shared equally between 2 people')).toBeInTheDocument()
  })

  it('asks for a status filter server-side and returns to page 1', async () => {
    renderPage()
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'paid')
    expect(hooks.params).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paid', page: 1 }))
  })

  it('shows the honest empty state', () => {
    hooks.commissions = listWith([])
    renderPage()
    expect(screen.getByTestId('earnings-empty')).toHaveTextContent('No earnings yet')
  })

  it('an unreachable backend is an error card, not an empty list', () => {
    hooks.commissions = { error: new ApiError(0, 'Network request failed') }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/Can’t reach the server/)
    expect(screen.queryByTestId('earnings-empty')).toBeNull()
  })
})

describe('Raise a query (E3)', () => {
  it('sends the trimmed message and confirms', async () => {
    hooks.raise.mockResolvedValue(makeQuery())
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Raise a query' }))
    await userEvent.type(screen.getByLabelText('What would you like Grid Nova to check?'), '  Why 5%?  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send query' }))
    await waitFor(() => expect(hooks.raise).toHaveBeenCalledWith({ entryId: 12, message: 'Why 5%?' }))
    expect(await screen.findByText('Your query was sent to Grid Nova.')).toBeInTheDocument()
  })

  it('an empty message is refused locally, marks the field invalid and focuses it', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Raise a query' }))
    await userEvent.click(screen.getByRole('button', { name: 'Send query' }))
    const field = screen.getByLabelText('What would you like Grid Nova to check?')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveFocus()
    expect(hooks.raise).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Write your question first.')
  })

  it('translates the server’s refusal by code instead of showing its English', async () => {
    hooks.raise.mockRejectedValue(new ApiError(409, 'API error 409', 'Query window closed', { code: 'query_window_closed' }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Raise a query' }))
    await userEvent.type(screen.getByLabelText('What would you like Grid Nova to check?'), 'hello')
    await userEvent.click(screen.getByRole('button', { name: 'Send query' }))
    expect(await screen.findByText('The query window for this entry has closed.')).toBeInTheDocument()
    expect(screen.queryByText('Query window closed')).toBeNull()
  })

  it('after the window the button is disabled and says why', () => {
    hooks.commissions = listWith([withQuery(makeEntry(), { open: false, window_closes_at: '2020-01-01T00:00:00Z' })])
    renderPage()
    const button = screen.getByRole('button', { name: 'Raise a query' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(/query window closed on 01 Jan 2020/)
  })

  it('an open query disables the button and shows the history with Grid Nova’s reply', async () => {
    hooks.commissions = listWith([withQuery(makeEntry(), { open: true, window_closes_at: '2099-01-01T00:00:00Z' })])
    hooks.queries = { data: { items: [makeQuery({ status: 'answered', response: 'Rate is per schedule v1.', responded_at: '2026-10-20T05:00:00Z' })] } }
    renderPage()
    expect(screen.getByRole('button', { name: 'Query open' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'See queries' }))
    expect(screen.getByText('Why is my rate 5%?')).toBeInTheDocument()
    expect(screen.getByText('Rate is per schedule v1.')).toBeInTheDocument()
  })

  it('opens the history for the entry named in the link from the home feed', () => {
    hooks.search = 'entry=12'
    hooks.queries = { data: { items: [makeQuery()] } }
    renderPage()
    expect(screen.getByTestId('query-item')).toHaveTextContent('Why is my rate 5%?')
    expect(screen.getByText(/Waiting for Grid Nova/)).toBeInTheDocument()
  })
})

describe('Payouts (E2)', () => {
  it('lists period, gross, TDS, recoveries, net, paid date, bank last4 and reference', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Payouts' }))
    const item = screen.getByTestId('payout-item')
    expect(item).toHaveTextContent('2026-10')
    expect(item).toHaveTextContent('₹25,000.10')
    expect(item).toHaveTextContent('₹250.50')
    expect(item).toHaveTextContent('TDS (2%)')
    expect(item).toHaveTextContent('₹494.99')
    expect(item).toHaveTextContent('₹24,254.61')
    expect(item).toHaveTextContent('Paid on 10 Nov 2026')
    expect(item).toHaveTextContent('Bank account ending 4321')
    expect(item).toHaveTextContent('Bank reference: UTR123456')
    expect(item).toHaveTextContent('Paid')
  })

  it('has an honest empty state', async () => {
    hooks.payouts = { data: { items: [] } }
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Payouts' }))
    expect(screen.getByTestId('payouts-empty')).toBeInTheDocument()
  })
})

describe('Languages (hi / bn)', () => {
  it.each([
    ['hi', hi.associates.portal.earnings, 'कमाई'],
    ['bn', bn.associates.portal.earnings, 'আয়'],
  ])('%s renders translated copy, including a translated refusal', async (_l, c, title) => {
    hooks.raise.mockRejectedValue(new ApiError(409, 'x', 'English from the server', { code: 'query_already_open' }))
    renderPage(c as typeof copy)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
    await userEvent.click(screen.getByRole('button', { name: c.query.raise }))
    await userEvent.type(screen.getByLabelText(c.query.label), 'x')
    await userEvent.click(screen.getByRole('button', { name: c.query.submit }))
    expect(await screen.findByText(c.query.errors.query_already_open)).toBeInTheDocument()
    expect(screen.queryByText('English from the server')).toBeNull()
  })
})
