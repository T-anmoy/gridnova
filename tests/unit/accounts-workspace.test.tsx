import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { navState } from './helpers/mock-navigation'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountsPage from '@/app/(internal)/dashboard/accounts/page'
import PaymentDetailPage from '@/app/(internal)/dashboard/accounts/payments/[id]/page'
import { ApiError } from '@/lib/dashboard/api-error'
import { withI18n } from './helpers/i18n'
import { typeDateField } from './helpers/date-field'
import type { Milestone, StaffPayment } from '@/lib/associate/payment-types'

const h = vi.hoisted(() => ({
  role: { role: 'accounts' as string | undefined, isLoaded: true },
  list: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  listParams: [] as unknown[],
  milestones: {} as { data?: unknown; isLoading?: boolean },
  milestoneParams: [] as unknown[],
  detail: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  queues: { data: undefined as unknown },
  deposit: vi.fn(),
  verify: vi.fn(),
  dishonour: vi.fn(),
  cancel: vi.fn(),
  resend: vi.fn(),
  release: vi.fn(),
  download: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('@/lib/access/use-permissions', async () => {
  const { permissionsValue } = await import('./helpers/permissions-bridge')
  // The signed-in role (h.role) as the BE-17 permissions it holds.
  return { usePermissions: () => { const r = h.role as { role?: string; isLoaded?: boolean }; return permissionsValue(r.role ? [r.role as never] : [], { isLoaded: r.isLoaded ?? true }) } }
})
vi.mock('@/lib/dashboard/accounts-api-client', () => ({
  usePaymentList: (p: unknown) => (h.listParams.push(p), { ...h.list, refetch: h.refetch }),
  useMilestoneQueue: (p: unknown) => (h.milestoneParams.push(p), { ...h.milestones, refetch: h.refetch }),
  usePaymentDetail: () => ({ ...h.detail, refetch: h.refetch }),
  useDepositPayment: () => ({ mutateAsync: h.deposit, isPending: false }),
  useVerifyPayment: () => ({ mutateAsync: h.verify }),
  useDishonourPayment: () => ({ mutateAsync: h.dishonour }),
  useCancelStaffPayment: () => ({ mutateAsync: h.cancel }),
  useResendReceipt: () => ({ mutateAsync: h.resend, isPending: false }),
  useReleaseHeldReceipts: () => ({ mutateAsync: h.release, isPending: false }),
  downloadExport: h.download,
  fetchStaffPaymentProofLink: vi.fn(),
}))
vi.mock('@/lib/dashboard/payments-api-client', () => ({ useUploadStaffPaymentProof: () => ({ mutateAsync: vi.fn() }) }))
vi.mock('@/lib/dashboard/execution-api-client', () => ({ useWorkQueues: () => h.queues }))
vi.mock('next/navigation', async () => {
  const nav = (await import('./helpers/mock-navigation')).navigationMock
  return { ...nav, useRouter: () => ({ ...nav.useRouter(), push: h.push }), useParams: () => ({ id: '11' }) }
})
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }), useClerk: () => ({ signOut: vi.fn() }) }))

const pay = (over: Partial<StaffPayment> = {}): StaffPayment => ({
  payment_id: 11,
  onboarding_id: 5,
  milestone_id: 1,
  amount: '100000.00',
  mode: 'neft',
  reference: 'UTR1',
  bank_name: null,
  instrument_date: null,
  payer_name: 'Asha',
  status: 'recorded',
  has_proof: true,
  proof_filename: 'proof.pdf',
  recorded_by: 'GNA-1',
  recorded_at: '2026-03-02T10:00:00Z',
  deposited_at: null,
  verified_at: null,
  dishonoured_at: null,
  dishonour_reason: null,
  cancelled_at: null,
  cancel_reason: null,
  receipt: null,
  deposited_by: null,
  verified_by: null,
  dishonoured_by: null,
  cancelled_by: null,
  needs_attention: false,
  attention_reasons: [],
  ...over,
})

const project = { onboarding_id: 5, customer_name: 'Bikash Das', customer_email: 'b@x.in', project_reference_id: 'GN-1', current_stage: 'accepted', accepted_total: '500000.00', paid_verified: '0.00', awaiting_verification: '100000.00', balance: '500000.00' }

const page = (items: unknown[]) => ({ data: { items, page: 1, page_size: 25, total: items.length } })

beforeAll(() => {
  // Radix Select needs these pointer APIs, which jsdom lacks.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  navState.reset('/dashboard/accounts')
  h.role = { role: 'accounts', isLoaded: true }
  h.list = page([])
  h.milestones = page([])
  h.listParams.length = 0
  h.milestoneParams.length = 0
  h.detail = {}
  h.queues = { data: undefined }
  for (const f of [h.deposit, h.verify, h.dishonour, h.cancel, h.resend, h.release, h.download, h.push, h.refetch]) f.mockReset()
})

describe('Accounts workspace — access', () => {
  it.each(['operations', 'engineer', 'sales'])('%s sees no payment UI and no payment request is made', (role) => {
    h.role = { role, isLoaded: true }
    render(withI18n(<AccountsPage />))
    expect(screen.getByTestId('no-access')).toBeInTheDocument()
    expect(h.listParams).toHaveLength(0)
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('management gets a read-only view: no export, release or resend', async () => {
    h.role = { role: 'management', isLoaded: true }
    h.list = page([pay({ status: 'verified', receipt: { receipt_number: 'GNR-1', email_status: 'sent', emailed_at: null, pdf_available: true, receipt_pending_email: false, held: false, url: 'u' } })])
    render(withI18n(<AccountsPage />))
    expect(screen.getByText('Read-only view.')).toBeInTheDocument()
    expect(screen.queryByTestId('export-panel')).toBeNull()
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Receipts' }))
    expect(screen.queryByRole('button', { name: 'Release held receipts' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resend' })).toBeNull()
  })
})

describe('Accounts workspace — payments queue', () => {
  it('has a one-click needs-attention filter and shows each attention reason as a chip', async () => {
    h.list = page([pay({ needs_attention: true, attention_reasons: ['awaiting_verification', 'proof_missing', 'cheque_hold_exceeded'] })])
    h.queues = { data: { payments: { awaiting_verification: 4, dishonoured: 1, receipts_held: 2, receipts_without_email: 0, overdue_milestones: 3 } } }
    render(withI18n(<AccountsPage />))
    const row = screen.getByTestId('payment-row')
    expect(within(row).getAllByTestId('attention-chip').map((c) => c.textContent)).toEqual([
      'Waiting too long for verification',
      'Proof missing',
      'Cheque deposited too long ago',
    ])
    expect(row).toHaveTextContent('₹1,00,000.00')
    expect(screen.getByTestId('queue-summary')).toHaveTextContent('Overdue instalments')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Needs attention' }))
    await waitFor(() => expect(h.listParams.at(-1)).toMatchObject({ needs_attention: true, page: 1 }))
  })

  it('opens a payment from its row, shows an empty state, and handles errors with Retry', async () => {
    h.list = page([pay()])
    const { unmount } = render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByTestId('payment-row'))
    expect(h.push).toHaveBeenCalledWith('/dashboard/accounts/payments/11')
    unmount()
    h.list = page([])
    const second = render(withI18n(<AccountsPage />))
    expect(screen.getByText('No payments match.')).toBeInTheDocument()
    second.unmount()
    h.list = { error: new ApiError(500, 'x', 'boom') }
    render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(h.refetch).toHaveBeenCalled()
  })

  it('offers no cash method in the filter', async () => {
    render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Payment method' }))
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    // Retired methods stay in the filter for older rows, labelled (associate_journeys.md §5).
    expect(options).toEqual(['All methods', 'Cheque', 'Demand draft (no longer accepted)', 'NEFT', 'RTGS', 'IMPS', 'UPI (no longer accepted)'])
  })
})

describe('Accounts workspace — instalments', () => {
  it('shows server amounts as returned, an overdue chip, and never assumes onboarding_id in links', async () => {
    const m = (over: Partial<Milestone>): Milestone => ({ milestone_id: 1, number: 1, label: 'On Order', percent: '20', amount_due: '100000.00', paid_toward: '0.00', outstanding: '100000.00', trigger: 'accepted', due_status: 'due', due_since: '2026-03-01T00:00:00Z', overdue: true, project_id: 9, onboarding_id: null, ...over })
    h.milestones = page([m({}), m({ milestone_id: 2, onboarding_id: 5, overdue: false, label: 'Before Commissioning' })])
    render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Instalments' }))
    const rows = screen.getAllByTestId('milestone-row')
    expect(rows[0]).toHaveTextContent('Project 9')
    expect(within(rows[0]).queryByRole('link')).toBeNull()
    expect(within(rows[0]).getByTestId('overdue-chip')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/dashboard/onboardings/5')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Overdue only' }))
    await waitFor(() => expect(h.milestoneParams.at(-1)).toMatchObject({ needs_attention: true }))
  })
})

describe('Accounts workspace — receipts', () => {
  const held = pay({
    status: 'verified',
    attention_reasons: ['receipt_held', 'receipt_pending_email'],
    receipt: { receipt_number: 'GNR-2026-000001', email_status: 'pending', emailed_at: null, pdf_available: false, receipt_pending_email: true, held: true, url: null, held_reason: 'Company details still contain DUMMY text', email_skipped_reason: null },
  })

  it('derives the receipts view from verified payments, with the dummy chip and receipt reasons', async () => {
    h.list = page([held])
    render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Receipts' }))
    expect(h.listParams.at(-1)).toMatchObject({ status: 'verified' })
    const row = screen.getByTestId('receipt-row')
    expect(row).toHaveTextContent('GNR-2026-000001')
    expect(within(row).getByTestId('dummy-chip')).toHaveTextContent('Dummy / pending Grid Nova')
    expect(within(row).getAllByTestId('attention-chip').map((c) => c.textContent)).toEqual(['Receipt held', 'Receipt not emailed yet'])
  })

  it('release-held reports released / still held / reason', async () => {
    h.list = page([held])
    h.release.mockResolvedValue({ released: 2, still_held: 1, reason: 'registry P5 unresolved' })
    const user = userEvent.setup()
    render(withI18n(<AccountsPage />))
    await user.click(screen.getByRole('tab', { name: 'Receipts' }))
    await user.click(screen.getByRole('button', { name: 'Release held receipts' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Released 2; still held 1 — registry P5 unresolved.')
  })

  it('resend explains resend_too_soon (429) in plain words', async () => {
    h.list = page([held])
    h.resend.mockRejectedValue(new ApiError(429, 'x', 'slow down', { code: 'resend_too_soon' }))
    const user = userEvent.setup()
    render(withI18n(<AccountsPage />))
    await user.click(screen.getByRole('tab', { name: 'Receipts' }))
    await user.click(screen.getByRole('button', { name: 'Resend' }))
    expect(await screen.findByRole('status')).toHaveTextContent('A receipt was sent a moment ago')
  })
})

describe('Accounts workspace — CSV export', () => {
  it('downloads each export through the authenticated blob helper with the chosen dates', async () => {
    h.download.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(withI18n(<AccountsPage />))
    const panel = screen.getByTestId('export-panel')
    await typeDateField(user, 'Export from', '01032026')
    await typeDateField(user, 'Export to', '31032026')
    await user.click(within(panel).getByRole('button', { name: /Ledger CSV/ }))
    expect(h.download).toHaveBeenCalledWith('ledger', 'tok', { date_from: '2026-03-01', date_to: '2026-03-31' })
    await user.click(within(panel).getByRole('button', { name: /Payments CSV/ }))
    expect(h.download).toHaveBeenLastCalledWith('payments', 'tok', { date_from: '2026-03-01', date_to: '2026-03-31' })
  })
})

async function showDetail() {
  render(withI18n(<PaymentDetailPage />))
  await screen.findByTestId('payment-detail')
}

describe('Payment detail — actions', () => {
  it('shows the project block with server amounts, and "replaces bounced payment" for a re-recorded cheque', async () => {
    h.detail = { data: { ...pay({ previous_payment_id: 7 }), project } }
    await showDetail()
    expect(screen.getByTestId('project-block')).toHaveTextContent('₹5,00,000.00')
    expect(screen.getByTestId('replaces')).toHaveTextContent('Replaces bounced payment #7')
    expect(within(screen.getByTestId('project-block')).getByRole('link', { name: 'Bikash Das' })).toHaveAttribute('href', '/dashboard/onboardings/5')
  })

  it('does not link to an onboarding when onboarding_id is null', async () => {
    h.detail = { data: { ...pay({ onboarding_id: null }), project: { ...project, onboarding_id: null, project_id: 9 } } }
    await showDetail()
    expect(within(screen.getByTestId('project-block')).queryByRole('link')).toBeNull()
  })

  it('deposit is offered only for cheque / demand draft', async () => {
    h.detail = { data: { ...pay({ mode: 'neft' }), project } }
    await showDetail()
    expect(screen.queryByRole('button', { name: 'Mark deposited' })).toBeNull()
  })

  it('deposits a recorded cheque', async () => {
    h.detail = { data: { ...pay({ mode: 'cheque', bank_name: 'SBI', instrument_date: '2026-03-05' }), project } }
    h.deposit.mockResolvedValue(pay())
    await showDetail()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mark deposited' }))
    expect(h.deposit).toHaveBeenCalledWith({ paymentId: 11 })
  })

  it('explains the proof_required 409 in plain words and offers proof upload for a payment without proof', async () => {
    h.detail = { data: { ...pay({ has_proof: false, proof_filename: null }), project } }
    h.verify.mockRejectedValue(new ApiError(409, 'x', 'proof', { code: 'proof_required' }))
    const user = userEvent.setup()
    await showDetail()
    expect(screen.getByTestId('staff-proof-upload')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verify' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('recorded by an associate and has no proof')
  })

  it('self_verification: Accounts is told plainly and cannot proceed', async () => {
    h.detail = { data: { ...pay(), project } }
    h.verify.mockRejectedValue(new ApiError(409, 'x', 'self', { code: 'self_verification' }))
    const user = userEvent.setup()
    await showDetail()
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verify' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('You recorded this payment, so another Accounts person must verify it.')
    expect(within(dialog).getByRole('button', { name: 'Verify' })).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'Verify as admin' })).toBeNull()
  })

  it('self_verification: an Admin is offered the admin path, which needs a reason, and sends it', async () => {
    h.role = { role: 'admin', isLoaded: true }
    h.detail = { data: { ...pay(), project } }
    h.verify.mockRejectedValueOnce(new ApiError(409, 'x', 'self', { code: 'self_verification' })).mockResolvedValue(pay({ status: 'verified' }))
    const user = userEvent.setup()
    await showDetail()
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verify' }))
    const dialog = screen.getByRole('dialog')
    const asAdmin = await within(dialog).findByRole('button', { name: 'Verify as admin' })
    expect(asAdmin).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Bank statement checked, accountant unavailable')
    await user.click(asAdmin)
    expect(h.verify).toHaveBeenLastCalledWith({ paymentId: 11, reason: 'Bank statement checked, accountant unavailable' })
  })

  it('dishonour and cancel each require a reason', async () => {
    h.detail = { data: { ...pay(), project } }
    h.dishonour.mockResolvedValue(pay())
    h.cancel.mockResolvedValue(pay())
    const user = userEvent.setup()
    await showDetail()
    await user.click(screen.getByRole('button', { name: 'Dishonour' }))
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Dishonour' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Cheque bounced')
    await user.click(within(dialog).getByRole('button', { name: 'Dishonour' }))
    expect(h.dishonour).toHaveBeenCalledWith({ paymentId: 11, reason: 'Cheque bounced' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Cancel payment' }))
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Cancel payment' })).toBeDisabled()
  })

  it('management sees the payment but no action buttons', async () => {
    h.role = { role: 'management', isLoaded: true }
    h.detail = { data: { ...pay(), project } }
    await showDetail()
    expect(screen.queryByTestId('payment-actions')).toBeNull()
  })

  it('operations never reaches the payment', () => {
    h.role = { role: 'operations', isLoaded: true }
    render(withI18n(<PaymentDetailPage />))
    return screen.findByTestId('no-access')
  })

  it('shows a held receipt with the Dummy chip and a resend action', async () => {
    h.detail = {
      data: {
        ...pay({ status: 'verified', receipt: { receipt_number: 'GNR-2026-000002', email_status: null, emailed_at: null, pdf_available: false, receipt_pending_email: false, held: true, url: null, held_reason: 'Wording contains DUMMY text', email_skipped_reason: null } }),
        project,
      },
    }
    await showDetail()
    expect(screen.getByTestId('dummy-chip')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend receipt' })).toBeInTheDocument()
  })
})

describe('Accounts workspace — rows say who the customer is (customer_name, project_reference_id)', () => {
  const named = (id: number, name: string | null, code: string | null) => pay({ payment_id: id, customer_name: name, project_reference_id: code })
  const milestone = (id: number, name: string | null, code: string | null, over: Partial<Milestone> = {}) =>
    ({
      milestone_id: id, number: 1, label: 'On Order', percent: '30', amount_due: '30000.00', paid_toward: '0.00', outstanding: '30000.00',
      trigger: null, due_status: 'due', due_since: null, overdue: false, onboarding_id: 5, project_id: 9, needs_attention: false,
      customer_name: name, project_reference_id: code, ...over,
    }) as Milestone

  it('payments queue: row shows the customer name with the project code', () => {
    h.list = page([named(11, 'Bikash Das', 'GN-2026-1'), named(12, 'Asha Roy', 'GN-2026-2')])
    render(withI18n(<AccountsPage />))
    const rows = screen.getAllByTestId('payment-row')
    expect(rows[0]).toHaveTextContent('Bikash Das')
    expect(rows[0]).toHaveTextContent('GN-2026-1')
    expect(rows[0]).toHaveTextContent('Payment #11')
  })

  // P8: the search used to filter only the 25 rows already loaded, so a payment
  // on any other page was "not found". It is now the backend's `q`, applied
  // before paging.
  it('payments search: sends the backend `q` after a 300 ms pause (not per keystroke), keeps the other filters, and never filters the loaded page itself', async () => {
    h.list = page([named(11, 'Bikash Das', 'GN-2026-1'), named(12, 'Asha Roy', 'GN-2026-2')])
    render(withI18n(<AccountsPage />))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Needs attention' }))
    const before = h.listParams.length
    await user.type(screen.getByRole('searchbox'), 'asha')
    // Typing alone sends nothing…
    expect(h.listParams.slice(before).every((p) => !('q' in (p as { q?: string })) || (p as { q?: string }).q === undefined)).toBe(true)
    // …and both rows stay: the loaded page is not filtered client-side.
    expect(screen.getAllByTestId('payment-row')).toHaveLength(2)
    await waitFor(() => expect(h.listParams.at(-1)).toMatchObject({ q: 'asha', page: 1, needs_attention: true, page_size: 25 }))
  })

  it('payments search: a new search returns to page 1, and clearing it removes `q`', async () => {
    h.list = { ...page([named(11, 'Bikash Das', 'GN-2026-1')]), data: { items: [named(11, 'Bikash Das', 'GN-2026-1')], page: 2, page_size: 25, total: 60 } }
    render(withI18n(<AccountsPage />))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(h.listParams.at(-1)).toMatchObject({ page: 2 })
    await user.type(screen.getByRole('searchbox'), 'GNR-9')
    await waitFor(() => expect(h.listParams.at(-1)).toMatchObject({ q: 'GNR-9', page: 1 }))
    await user.clear(screen.getByRole('searchbox'))
    await waitFor(() => expect((h.listParams.at(-1) as { q?: string }).q).toBeUndefined())
    expect(h.listParams.at(-1)).toMatchObject({ page: 1 })
  })

  it('payments search: shows the empty state from the server result', () => {
    h.list = page([])
    render(withI18n(<AccountsPage />))
    expect(screen.getByText('No payments match.')).toBeInTheDocument()
  })

  it('payments queue: a row without a name or code shows only its payment number, not an invented customer', () => {
    h.list = page([named(13, null, null)])
    render(withI18n(<AccountsPage />))
    const row = screen.getByTestId('payment-row')
    expect(within(row).queryByTestId('who-cell')).toBeNull()
    expect(row).toHaveTextContent('Payment #13')
  })

  it('instalments tab: customer name and code replace "Project n", filterable, still linking to the project', async () => {
    h.milestones = page([milestone(1, 'Bikash Das', 'GN-2026-1'), milestone(2, 'Asha Roy', 'GN-2026-2', { onboarding_id: 6 })])
    render(withI18n(<AccountsPage />))
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Instalments' }))
    const rows = screen.getAllByTestId('milestone-row')
    expect(rows[0]).toHaveTextContent('Bikash Das')
    expect(rows[0]).toHaveTextContent('GN-2026-1')
    expect(within(rows[0]).getByRole('link', { name: 'Open project' })).toHaveAttribute('href', '/dashboard/onboardings/5')
    await user.type(screen.getByRole('searchbox'), 'GN-2026-2')
    expect(screen.getAllByTestId('milestone-row')).toHaveLength(1)
    expect(screen.getByTestId('milestone-row')).toHaveTextContent('Asha Roy')
  })

  it('instalments tab: falls back to the old project link when the backend sends no name', async () => {
    h.milestones = page([milestone(1, null, null)])
    render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Instalments' }))
    expect(within(screen.getByTestId('milestone-row')).getByRole('link', { name: 'Project 9' })).toBeInTheDocument()
  })

  it('receipts view: shows the customer and searches on the server (q) with status=verified kept', async () => {
    const rcpt = { receipt_number: 'GNR-1', email_status: 'sent', emailed_at: null, pdf_available: true, receipt_pending_email: false, held: false, url: 'u' }
    h.list = page([
      { ...named(11, 'Bikash Das', 'GN-2026-1'), status: 'verified', receipt: rcpt },
      { ...named(12, 'Asha Roy', 'GN-2026-2'), status: 'verified', receipt: { ...rcpt, receipt_number: 'GNR-2' } },
    ])
    render(withI18n(<AccountsPage />))
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Receipts' }))
    const rows = screen.getAllByTestId('receipt-row')
    expect(rows[1]).toHaveTextContent('Asha Roy')
    expect(rows[1]).toHaveTextContent('GN-2026-2')
    await user.type(screen.getByRole('searchbox'), 'GNR-1')
    expect(screen.getAllByTestId('receipt-row')).toHaveLength(2)
    await waitFor(() => expect(h.listParams.at(-1)).toMatchObject({ status: 'verified', q: 'GNR-1', page: 1 }))
  })
})

// FE-20 (BE-20): a direct customer's rows carry lead_id and a null onboarding_id.
describe('Accounts workspace — direct customers', () => {
  const direct = pay({ payment_id: 51, onboarding_id: null, lead_id: 12, customer_name: 'Ramesh Das', project_reference_id: 'GNE-WB-RES-2026-00012' })

  it('payments: the customer, a "Direct" tag and a link to the lead’s Payments tab — no onboarding link, no crash', () => {
    h.list = page([direct, pay({ payment_id: 52 })])
    render(withI18n(<AccountsPage />))
    const [d, assoc] = screen.getAllByTestId('payment-row')
    expect(d).toHaveTextContent('Ramesh Das')
    expect(within(d).getByTestId('direct-tag')).toHaveTextContent('Direct')
    expect(within(d).getByRole('link', { name: 'Open lead' })).toHaveAttribute('href', '/dashboard/leads/12?tab=payments')
    expect(within(d).queryByRole('link', { name: /onboarding/i })).toBeNull()
    expect(within(assoc).queryByTestId('direct-tag')).toBeNull()
  })

  it('?lead_id= narrows the payments and receipts lists to that lead, and can be cleared', async () => {
    navState.reset('/dashboard/accounts', 'lead_id=12')
    h.list = page([direct])
    const user = userEvent.setup()
    render(withI18n(<AccountsPage />))
    expect(h.listParams.at(-1)).toMatchObject({ lead_id: 12 })
    expect(screen.getByTestId('lead-filter')).toHaveTextContent('Lead #12 only')
    await user.click(screen.getByRole('tab', { name: 'Receipts' }))
    expect(h.listParams.at(-1)).toMatchObject({ lead_id: 12, status: 'verified' })
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(navState.params.get('lead_id')).toBeNull()
    await waitFor(() => expect(h.listParams.at(-1)).toMatchObject({ lead_id: undefined }))
  })

  it('instalments: direct milestones after the associate ones, tagged and linked to the lead', async () => {
    const m = (over: Partial<Milestone>): Milestone => ({ milestone_id: 7, number: 1, label: 'On Order', percent: '20.00', amount_due: '54450.00', paid_toward: '0.00', outstanding: '54450.00', trigger: 'accepted', due_status: 'due', due_since: '2026-10-01T00:00:00Z', overdue: true, project_id: 20, onboarding_id: 5, ...over })
    // The same milestone_id on both sides must not collide.
    h.milestones = page([m({}), m({ onboarding_id: null, lead_id: 12, customer_name: 'Ramesh Das' } as Partial<Milestone>)])
    render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Instalments' }))
    const rows = screen.getAllByTestId('milestone-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).queryByTestId('direct-tag')).toBeNull()
    expect(within(rows[1]).getByTestId('direct-tag')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('link', { name: 'Open lead' })).toHaveAttribute('href', '/dashboard/leads/12?tab=payments')
  })

  it('receipts: a direct customer’s receipt row is tagged', async () => {
    h.list = page([{ ...direct, status: 'verified', receipt: { receipt_number: 'GNR-2026-00007', email_status: 'held', emailed_at: null, pdf_available: false, receipt_pending_email: false, held: true, url: null } }])
    render(withI18n(<AccountsPage />))
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Receipts' }))
    expect(within(screen.getByTestId('receipt-row')).getByTestId('direct-tag')).toBeInTheDocument()
  })

  it('payment detail: the customer links to the lead’s Payments tab', async () => {
    h.detail = { data: { ...direct, project: { ...project, onboarding_id: null, lead_id: 12, customer_name: 'Ramesh Das' } } }
    await showDetail()
    const block = screen.getByTestId('project-block')
    expect(within(block).getByRole('link', { name: 'Ramesh Das' })).toHaveAttribute('href', '/dashboard/leads/12?tab=payments')
    expect(within(block).getByTestId('direct-tag')).toBeInTheDocument()
  })
})
