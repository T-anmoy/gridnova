import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommissionEntries from '@/components/dashboard/commissions/CommissionEntries'
import RateSchedules from '@/components/dashboard/commissions/RateSchedules'
import PayoutBatches from '@/components/dashboard/commissions/PayoutBatches'
import PayoutBatchDetail from '@/components/dashboard/commissions/PayoutBatchDetail'
import CommissionQueries from '@/components/dashboard/commissions/CommissionQueries'
import CommissionsShell from '@/components/dashboard/commissions/CommissionsShell'
import { ApiError } from '@/lib/dashboard/api-error'
import { navState } from './helpers/mock-navigation'
import {
  PENDING_ENTRY,
  RATE_KEYS,
  RATE_SCHEDULES,
  RECOVERY_ENTRY,
  REVERSAL_ENTRY,
  makeBatch,
  makeEntry,
  makeQuery,
} from './fixtures/commissions-contract'
import { dateGroup, dayInput } from './helpers/date-field'

const h = vi.hoisted(() => ({
  role: { role: 'accounts' as string | undefined, isLoaded: true } as { role?: string; roles?: string[]; isLoaded: boolean },
  me: { data: { id: 'EMP-2' } as { id: string } | undefined },
  entries: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  entryParams: vi.fn(),
  schedules: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  batches: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  batch: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  queries: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  approve: vi.fn(),
  reverse: vi.fn(),
  publish: vi.fn(),
  reRate: vi.fn(),
  create: vi.fn(),
  approveBatch: vi.fn(),
  markPaid: vi.fn(),
  cancel: vi.fn(),
  respond: vi.fn(),
  download: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/lib/access/use-permissions', async () => {
  const { permissionsValue } = await import('./helpers/permissions-bridge')
  // The signed-in role (h.role) as the BE-17 permissions it holds.
  return { usePermissions: () => { const r = h.role as { role?: string; roles?: string[]; isLoaded?: boolean }; return permissionsValue((r.roles ?? (r.role ? [r.role] : [])) as never[], { isLoaded: r.isLoaded ?? true }) } }
})
vi.mock('@/lib/dashboard/api-client', () => ({ useEmployeeMe: () => h.me }))
vi.mock('@/lib/commissions/staff-api-client', () => ({
  useStaffCommissions: (p: unknown) => (h.entryParams(p), { refetch: vi.fn(), isFetching: false, ...h.entries }),
  useApproveCommissions: () => ({ mutateAsync: h.approve, isPending: false }),
  useReverseCommission: () => ({ mutateAsync: h.reverse }),
  useRateSchedules: () => ({ refetch: vi.fn(), ...h.schedules }),
  usePublishRateSchedule: () => ({ mutateAsync: h.publish, isPending: false }),
  useReRate: () => ({ mutateAsync: h.reRate }),
  usePayoutBatches: () => ({ refetch: vi.fn(), ...h.batches }),
  usePayoutBatch: () => ({ refetch: vi.fn(), ...h.batch }),
  useCreatePayoutBatch: () => ({ mutateAsync: h.create, isPending: false }),
  useApprovePayoutBatch: () => ({ mutateAsync: h.approveBatch }),
  useMarkPayoutPaid: () => ({ mutateAsync: h.markPaid, isPending: false }),
  useCancelPayoutBatch: () => ({ mutateAsync: h.cancel }),
  useStaffCommissionQueries: () => ({ refetch: vi.fn(), ...h.queries }),
  useRespondToQuery: () => ({ mutateAsync: h.respond }),
  useCommissionExport: () => h.download,
}))
vi.mock('next/navigation', async () => {
  const nav = (await import('./helpers/mock-navigation')).navigationMock
  return { ...nav, useRouter: () => ({ ...nav.useRouter(), push: h.push }) }
})

const page = (items: unknown[], over: Record<string, unknown> = {}) => ({
  data: { items, page: 1, page_size: 25, total: items.length, totals: { earned: '1000.00', approved: '2500.50', paid: '99.00', pending_count: 1 }, ...over },
})

beforeEach(() => {
  vi.clearAllMocks()
  navState.reset('/dashboard/commissions')
  h.role = { role: 'accounts', isLoaded: true }
  h.me = { data: { id: 'EMP-2' } }
  h.entries = page([makeEntry(), REVERSAL_ENTRY, RECOVERY_ENTRY, PENDING_ENTRY, makeEntry({ entry_id: 20, status: 'approved' })])
  h.schedules = { data: RATE_SCHEDULES }
  h.batches = { data: { items: [makeBatch(), makeBatch({ batch_id: 2, period: '2026-09', status: 'paid' })] } }
  h.batch = { data: makeBatch() }
  h.queries = { data: { items: [makeQuery(), makeQuery({ query_id: 9, status: 'answered', response: 'Done', overdue: false })], page: 1, page_size: 25, total: 2 } }
  h.approve.mockResolvedValue({ approved: 1, items: [] })
})

describe('role visibility of the commission screens', () => {
  it('Accounts and Admin see the controls; Management gets a read-only view without them', () => {
    for (const [role, canAct] of [['accounts', true], ['admin', true], ['management', false]] as const) {
      h.role = { role, isLoaded: true }
      const { unmount } = render(<CommissionEntries />)
      expect(screen.queryAllByRole('checkbox').length > 0, role).toBe(canAct)
      expect(!!screen.queryByRole('button', { name: /^Approve/ }), role).toBe(canAct)
      unmount()
    }
  })

  it('the shell shows other roles a no-access page and never the commission screens', () => {
    for (const role of ['sales', 'engineer', 'operations'] as const) {
      h.role = { role, isLoaded: true }
      const { unmount } = render(<CommissionsShell><p>secret</p></CommissionsShell>)
      expect(screen.getByTestId('no-access')).toBeInTheDocument()
      expect(screen.queryByText('secret')).toBeNull()
      unmount()
    }
  })

  it('Management sees the shell with a read-only note', () => {
    h.role = { role: 'management', isLoaded: true }
    render(<CommissionsShell><p>ok</p></CommissionsShell>)
    expect(screen.getByText('Read-only view.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rate schedules' })).toBeInTheDocument()
  })
})

describe('Commissions list (E7)', () => {
  it('shows reversal and recovery rows in red as negative amounts, labelled', () => {
    render(<CommissionEntries />)
    const rows = screen.getAllByTestId('commission-row')
    const reversal = rows.find((r) => r.getAttribute('data-kind') === 'reversal')!
    expect(within(reversal).getByText('-₹1,000.00')).toHaveAttribute('data-negative', 'true')
    expect(within(reversal).getByTestId('deduction-badge')).toHaveTextContent('Reversal')
    const recovery = rows.find((r) => r.getAttribute('data-kind') === 'recovery')!
    expect(within(recovery).getByText('-₹250.50')).toHaveAttribute('data-negative', 'true')
  })

  it('a waiting entry says “Rate to be published” instead of an amount', () => {
    render(<CommissionEntries />)
    const row = screen.getAllByTestId('commission-row').find((r) => within(r).queryByTestId('rate-pending'))!
    expect(row).toHaveTextContent('Rate to be published')
    expect(row.textContent).not.toMatch(/₹0\.00|NaN/)
    expect(within(row).getByRole('checkbox')).toBeDisabled()
  })

  it('totals come from the endpoint, formatted from strings', () => {
    render(<CommissionEntries />)
    const totals = screen.getByTestId('commission-totals')
    expect(totals).toHaveTextContent('₹1,000.00')
    expect(totals).toHaveTextContent('₹2,500.50')
  })

  it('bulk approve asks for confirmation, then sends exactly the selected ids', async () => {
    render(<CommissionEntries />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select entry 12' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select entry 20' }))
    // the second is already approved, so it cannot be picked
    expect(screen.getByRole('checkbox', { name: 'Select entry 20' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Approve 1 selected' }))
    expect(h.approve).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(h.approve).toHaveBeenCalledWith([12]))
    expect(await screen.findByText('Approved 1 earning.')).toBeInTheDocument()
  })

  it('shows why entries could not be approved and keeps the dialog open', async () => {
    h.approve.mockRejectedValue(new ApiError(409, 'x', 'x', { code: 'entries_not_approvable', entries: [{ entry_id: 12, reason: 'not_rated' }] }))
    render(<CommissionEntries />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select entry 12' }))
    await userEvent.click(screen.getByRole('button', { name: 'Approve 1 selected' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText(/Nothing was approved\. #12 has no rate yet/)).toBeInTheDocument()
  })

  it('opens the entry with a link to the payment, and only an Admin can reverse', async () => {
    render(<CommissionEntries />)
    await userEvent.click(screen.getByRole('button', { name: /Details for entry 12/ }))
    expect(screen.getByTestId('payment-link')).toHaveAttribute('href', '/dashboard/accounts/payments/9')
    expect(screen.queryByRole('button', { name: /Reverse this earning/ })).toBeNull()
  })

  it('an Admin reverses an earning with a required reason', async () => {
    h.role = { role: 'admin', isLoaded: true }
    h.reverse.mockResolvedValue({ entry: REVERSAL_ENTRY })
    render(<CommissionEntries />)
    await userEvent.click(screen.getByRole('button', { name: /Details for entry 12/ }))
    await userEvent.click(screen.getByRole('button', { name: /Reverse this earning/ }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Reverse earning' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'False information')
    await userEvent.click(confirm)
    await waitFor(() => expect(h.reverse).toHaveBeenCalledWith({ entryId: 12, reason: 'False information' }))
  })

  it('filters go to the server and a failure is an error card, not an empty table', () => {
    navState.reset('/dashboard/commissions', 'status=earned&kind=earn&pending=1')
    h.entries = { error: new ApiError(0, 'Network request failed') }
    render(<CommissionEntries />)
    expect(h.entryParams).toHaveBeenCalledWith(expect.objectContaining({ status: 'earned', kind: 'earn', pending: true, page: 1 }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Can’t reach the server/)
    expect(screen.queryByText('No commission entries match.')).toBeNull()
  })
})

describe('Rate schedules (E8)', () => {
  it('lists versions, marks the placeholder and the one in force', () => {
    h.role = { role: 'admin', isLoaded: true }
    render(<RateSchedules />)
    const cards = screen.getAllByTestId('schedule-card')
    expect(cards).toHaveLength(3)
    expect(within(cards[1]).getByText('In force')).toBeInTheDocument()
    const placeholder = cards.find((c) => c.getAttribute('data-placeholder') === 'true')!
    expect(within(placeholder).getByTestId('placeholder-badge')).toBeInTheDocument()
    expect(within(placeholder).queryByRole('button', { name: /Re-rate/ })).toBeNull()
  })

  it('warns when only placeholder schedules exist', () => {
    h.role = { role: 'admin', isLoaded: true }
    h.schedules = { data: { ...RATE_SCHEDULES, items: [RATE_SCHEDULES.items[2]] } }
    render(<RateSchedules />)
    expect(screen.getByTestId('no-real-schedule')).toHaveTextContent('no payout can include them')
  })

  it('only an Admin gets the publish form and the re-rate action', () => {
    for (const [role, admin] of [['admin', true], ['accounts', false], ['management', false]] as const) {
      h.role = { role, isLoaded: true }
      const { unmount } = render(<RateSchedules />)
      expect(!!screen.queryByRole('form', { name: 'Publish a rate schedule' }), role).toBe(admin)
      expect(screen.queryAllByRole('button', { name: /Re-rate/ }).length > 0, role).toBe(admin)
      unmount()
    }
  })

  it('has one input per rate key in the contract', () => {
    h.role = { role: 'admin', isLoaded: true }
    render(<RateSchedules />)
    const form = screen.getByRole('form', { name: 'Publish a rate schedule' })
    expect(within(form).getAllByRole('textbox').filter((i) => i.getAttribute('inputmode') === 'decimal')).toHaveLength(RATE_KEYS.length)
  })

  async function fillRates(value = '2.5') {
    for (const input of screen.getAllByRole('textbox').filter((i) => i.getAttribute('inputmode') === 'decimal')) await userEvent.type(input, value)
  }
  const dateInput = () => dayInput(/Effective from/)

  it('enforces the notice period before calling the server and focuses the date field', async () => {
    h.role = { role: 'admin', isLoaded: true }
    render(<RateSchedules />)
    expect(screen.getByTestId('notice-hint')).toHaveTextContent('Earliest allowed: 29 Oct 2026')
    expect(dateGroup(/Effective from/)).toHaveAttribute('data-min', '2026-10-29')
    await fillRates()
    await userEvent.type(dateInput(), '20102026')
    await userEvent.click(screen.getByRole('button', { name: /Review and publish/ }))
    expect(dateInput()).toHaveAttribute('aria-invalid', 'true')
    expect(dateInput()).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot start before 29 Oct 2026/)
    expect(h.publish).not.toHaveBeenCalled()
  })

  it('refuses an invalid rate and names the field', async () => {
    h.role = { role: 'admin', isLoaded: true }
    render(<RateSchedules />)
    await fillRates()
    const first = screen.getAllByRole('textbox').find((i) => i.getAttribute('inputmode') === 'decimal')!
    await userEvent.clear(first)
    await userEvent.type(first, '101')
    await userEvent.type(dateInput(), '01112026')
    await userEvent.click(screen.getByRole('button', { name: /Review and publish/ }))
    expect(first).toHaveAttribute('aria-invalid', 'true')
    expect(first).toHaveFocus()
    expect(h.publish).not.toHaveBeenCalled()
  })

  it('publishes the exact body after a confirmation', async () => {
    h.role = { role: 'admin', isLoaded: true }
    h.publish.mockResolvedValue({ ...RATE_SCHEDULES.items[0], version: 4, effective_from: '2026-11-01' })
    render(<RateSchedules />)
    await fillRates('2.5')
    await userEvent.type(dateInput(), '01112026')
    await userEvent.click(screen.getByRole('button', { name: /Review and publish/ }))
    expect(h.publish).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish schedule' }))
    await waitFor(() =>
      expect(h.publish).toHaveBeenCalledWith({
        effective_from: '2026-11-01',
        is_placeholder: false,
        rates: Object.fromEntries(RATE_KEYS.map((k) => [k, '2.5'])),
      }),
    )
    expect(await screen.findByText(/Published version 4/)).toBeInTheDocument()
  })

  it('still shows the API’s refusal when the server disagrees with the client', async () => {
    h.role = { role: 'admin', isLoaded: true }
    h.publish.mockRejectedValue(new ApiError(422, 'x', 'x', { code: 'notice_period', earliest_effective_from: '2026-11-05' }))
    render(<RateSchedules />)
    await fillRates()
    await userEvent.type(dateInput(), '01112026')
    await userEvent.click(screen.getByRole('button', { name: /Review and publish/ }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish schedule' }))
    expect((await screen.findAllByText(/cannot start before 05 Nov 2026/)).length).toBeGreaterThan(0)
  })

  it('re-rate needs a reason and reports what was rated', async () => {
    h.role = { role: 'admin', isLoaded: true }
    h.reRate.mockResolvedValue({ schedule_id: 2, rated: 3, total_amount: '4500.25', still_pending: 1 })
    render(<RateSchedules />)
    await userEvent.click(screen.getAllByRole('button', { name: /Re-rate pending entries/ })[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Re-rate entries' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Rates confirmed')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Re-rate entries' }))
    await waitFor(() => expect(h.reRate).toHaveBeenCalledWith({ scheduleId: 3, reason: 'Rates confirmed' }))
    expect(await screen.findByTestId('rerate-result')).toHaveTextContent('Rated 3 entries (₹4,500.25 in total); 1 still waiting.')
  })
})

describe('Payout batches (E9)', () => {
  it('explains placeholder_rates and links to the rate schedules', async () => {
    h.create.mockRejectedValue(new ApiError(409, 'x', 'x', { code: 'placeholder_rates', pending_entries: 4 }))
    render(<PayoutBatches />)
    await userEvent.type(screen.getByLabelText('Month'), '2026-10')
    await userEvent.click(screen.getByRole('button', { name: 'Prepare batch' }))
    const alert = await screen.findByTestId('batch-error')
    expect(alert).toHaveTextContent('4 entries of this month have no amount')
    expect(within(alert).getByRole('link', { name: 'Open rate schedules' })).toHaveAttribute('href', '/dashboard/commissions/rates')
  })

  it('links to the existing draft when one is already open', async () => {
    h.create.mockRejectedValue(new ApiError(409, 'x', 'x', { code: 'draft_batch_exists', batch_id: 7 }))
    render(<PayoutBatches />)
    await userEvent.type(screen.getByLabelText('Month'), '2026-10')
    await userEvent.click(screen.getByRole('button', { name: 'Prepare batch' }))
    expect(await screen.findByRole('link', { name: 'Open draft batch #7' })).toHaveAttribute('href', '/dashboard/commissions/payouts/7')
  })

  it('opens the new batch after creating it', async () => {
    h.create.mockResolvedValue(makeBatch({ batch_id: 11 }))
    render(<PayoutBatches />)
    await userEvent.type(screen.getByLabelText('Month'), '2026-10')
    await userEvent.click(screen.getByRole('button', { name: 'Prepare batch' }))
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/dashboard/commissions/payouts/11'))
  })

  it('Management sees the batches but no create form or exports', () => {
    h.role = { role: 'management', isLoaded: true }
    render(<PayoutBatches />)
    expect(screen.getAllByTestId('batch-row')).toHaveLength(2)
    expect(screen.queryByRole('form', { name: 'Prepare a payout batch' })).toBeNull()
    expect(screen.queryByTestId('commission-exports')).toBeNull()
  })

  it('the TDS CSV (which holds full PANs) is downloaded only after a confirmation', async () => {
    render(<PayoutBatches />)
    await userEvent.click(screen.getByRole('button', { name: /TDS CSV/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('full PAN')
    expect(h.download).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Download TDS CSV' }))
    await waitFor(() => expect(h.download).toHaveBeenCalledWith({ kind: 'tds', financial_year: undefined }))
  })

  it('rejects a malformed financial year before asking the server', async () => {
    render(<PayoutBatches />)
    await userEvent.type(screen.getByLabelText(/Financial year/), '2026')
    expect(screen.getByRole('button', { name: /TDS CSV/ })).toBeDisabled()
    expect(screen.getByText(/Use a financial year like 2026-27/)).toBeInTheDocument()
  })
})

describe('Payout batch detail (E9)', () => {
  it('hides Approve from the person who prepared the batch (Accounts)', () => {
    h.role = { role: 'accounts', isLoaded: true }
    h.me = { data: { id: 'EMP-ACCOUNTS-1' } }
    render(<PayoutBatchDetail batchId={3} />)
    expect(screen.queryByRole('button', { name: 'Approve batch' })).toBeNull()
    expect(screen.getByTestId('preparer-note')).toBeInTheDocument()
  })

  it('shows Approve to a different Accounts user and approves after a confirmation', async () => {
    h.approveBatch.mockResolvedValue(makeBatch({ status: 'approved' }))
    render(<PayoutBatchDetail batchId={3} />)
    await userEvent.click(screen.getByRole('button', { name: 'Approve batch' }))
    expect(h.approveBatch).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(h.approveBatch).toHaveBeenCalledWith({ batchId: 3 }))
  })

  it('an Admin who prepared it can only approve with a reason', async () => {
    h.role = { role: 'admin', isLoaded: true }
    h.me = { data: { id: 'EMP-ACCOUNTS-1' } }
    h.approveBatch.mockResolvedValue(makeBatch({ status: 'approved' }))
    render(<PayoutBatchDetail batchId={3} />)
    expect(screen.queryByRole('button', { name: 'Approve batch' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Approve as Admin/ }))
    const dialog = await screen.findByRole('dialog')
    const go = within(dialog).getByRole('button', { name: 'Approve with override' })
    expect(go).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Only Accounts user available')
    await userEvent.click(go)
    await waitFor(() => expect(h.approveBatch).toHaveBeenCalledWith({ batchId: 3, reason: 'Only Accounts user available' }))
  })

  // BE-22: no TDS is deducted; above the FY threshold the batch lists the associates and needs an acknowledgement.
  describe('TDS review', () => {
    const review = [{
      associate_id: 'GNA-WB-26-00007', name: 'Asha Roy', fy_to_date: '30000.00', threshold: '20000.00',
      message: "This associate's commission this financial year is above ₹20,000. Grid Nova currently deducts no TDS. Confirm with your Chartered Accountant before paying.",
    }]

    it('lists the associates and approves only after the acknowledgement', async () => {
      h.batch = { data: makeBatch({ tds_review: review }) }
      h.approveBatch.mockResolvedValue(makeBatch({ status: 'approved' }))
      render(<PayoutBatchDetail batchId={3} />)
      const notice = screen.getByTestId('tds-review')
      expect(notice).toHaveTextContent('Asha Roy')
      expect(notice).toHaveTextContent('Confirm with your Chartered Accountant before paying.')
      await userEvent.click(screen.getByRole('button', { name: 'Approve batch' }))
      const dialog = await screen.findByRole('dialog')
      const go = within(dialog).getByRole('button', { name: 'Approve' })
      expect(go).toBeDisabled()
      await userEvent.click(within(dialog).getByTestId('tds-ack'))
      await userEvent.click(go)
      await waitFor(() => expect(h.approveBatch).toHaveBeenCalledWith({ batchId: 3, tdsReviewAcknowledged: true }))
    })

    it('mark-paid needs the acknowledgement too', async () => {
      h.batch = { data: makeBatch({ status: 'approved', approved_by: 'EMP-ACCOUNTS-9', tds_review: review }) }
      h.markPaid.mockResolvedValue(makeBatch({ status: 'paid' }))
      render(<PayoutBatchDetail batchId={3} />)
      const form = screen.getByRole('form', { name: 'Mark the batch as paid' })
      await userEvent.type(within(form).getByLabelText('Bank reference'), 'UTR998877')
      await userEvent.click(within(form).getByRole('button', { name: /Review and mark paid/ }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByRole('button', { name: 'Mark paid' })).toBeDisabled()
      await userEvent.click(within(dialog).getByTestId('tds-ack'))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }))
      await waitFor(() => expect(h.markPaid).toHaveBeenCalledWith(expect.objectContaining({ batchId: 3, tdsReviewAcknowledged: true })))
    })

    it('without a review there is no list and no tick', async () => {
      render(<PayoutBatchDetail batchId={3} />)
      expect(screen.queryByTestId('tds-review')).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Approve batch' }))
      expect(within(await screen.findByRole('dialog')).queryByTestId('tds-ack')).toBeNull()
    })
  })

  it('Management has no actions at all', () => {
    h.role = { role: 'management', isLoaded: true }
    render(<PayoutBatchDetail batchId={3} />)
    expect(screen.queryByRole('button', { name: /Approve|Cancel batch|Bank file/ })).toBeNull()
    expect(screen.getAllByTestId('batch-line')).toHaveLength(2)
  })

  it('flags an associate with no PAN on file', () => {
    h.batch = { data: makeBatch({ lines: [{ ...makeBatch().lines![0], pan_on_file: false }] }) }
    render(<PayoutBatchDetail batchId={3} />)
    expect(screen.getByTestId('no-pan')).toBeInTheDocument()
  })

  describe('approved batch', () => {
    beforeEach(() => {
      h.batch = { data: makeBatch({ status: 'approved', approved_by: 'EMP-ACCOUNTS-9' }) }
    })

    it('asks for a bank reference only on lines with money to pay', async () => {
      h.markPaid.mockResolvedValue(makeBatch({ status: 'paid' }))
      render(<PayoutBatchDetail batchId={3} />)
      const form = screen.getByRole('form', { name: 'Mark the batch as paid' })
      // the second line nets to ₹0.00, so only one reference box exists
      const boxes = within(form).getAllByLabelText('Bank reference')
      expect(boxes).toHaveLength(1)
      await userEvent.click(within(form).getByRole('button', { name: /Review and mark paid/ }))
      expect(boxes[0]).toHaveAttribute('aria-invalid', 'true')
      expect(boxes[0]).toHaveFocus()
      expect(h.markPaid).not.toHaveBeenCalled()
      await userEvent.type(boxes[0], 'UTR998877')
      await userEvent.click(within(form).getByRole('button', { name: /Review and mark paid/ }))
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark paid' }))
      await waitFor(() => expect(h.markPaid).toHaveBeenCalledWith({ batchId: 3, lines: [{ associate_id: 'GNA-WB-26-00007', bank_reference: 'UTR998877' }] }))
    })

    it('Accounts get the bank file, behind a confirmation about full account numbers', async () => {
      render(<PayoutBatchDetail batchId={3} />)
      await userEvent.click(screen.getByRole('button', { name: /Bank file/ }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent('full bank account numbers')
      expect(h.download).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Download bank file' }))
      await waitFor(() => expect(h.download).toHaveBeenCalledWith({ kind: 'bank', batchId: 3 }))
    })

    it('an Admin is never offered the bank file (the server refuses Admin)', () => {
      h.role = { role: 'admin', isLoaded: true }
      render(<PayoutBatchDetail batchId={3} />)
      expect(screen.queryByRole('button', { name: /Bank file/ })).toBeNull()
    })

    it('an Admin who also holds Accounts is offered the bank file (BE-17: the permission, not the role)', () => {
      h.role = { roles: ['admin', 'accounts'], isLoaded: true }
      render(<PayoutBatchDetail batchId={3} />)
      expect(screen.getByRole('button', { name: /Bank file/ })).toBeInTheDocument()
    })
  })
})

describe('Commission queries (E10)', () => {
  it('shows due dates and the overdue badge, and lets Accounts answer', async () => {
    h.queries = { data: { items: [makeQuery({ overdue: true, due_at: '2026-11-04T12:29:59Z' })], page: 1, page_size: 25, total: 1 } }
    h.respond.mockResolvedValue(makeQuery({ status: 'answered' }))
    render(<CommissionQueries />)
    const row = screen.getByTestId('query-row')
    expect(row).toHaveTextContent('04 Nov 2026')
    expect(within(row).getByTestId('overdue-badge')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: /Answer/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Send answer' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Your answer/), 'Rate is per schedule v1.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send answer' }))
    await waitFor(() => expect(h.respond).toHaveBeenCalledWith({ queryId: 8, response: 'Rate is per schedule v1.' }))
  })

  it('Management can read but not answer; answered queries have no Answer button', () => {
    h.role = { role: 'management', isLoaded: true }
    render(<CommissionQueries />)
    expect(screen.queryByRole('button', { name: /Answer/ })).toBeNull()
    expect(screen.getAllByTestId('query-row')).toHaveLength(2)
  })

  it('an answered query shows the response', () => {
    render(<CommissionQueries />)
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Answer/ })).toHaveLength(1)
  })
})
