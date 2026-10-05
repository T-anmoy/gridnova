import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountsPage from '@/app/(internal)/dashboard/accounts/page'
import PaymentDetailPage from '@/app/(internal)/dashboard/accounts/payments/[id]/page'
import { ApiError } from '@/lib/dashboard/api-error'
import { withI18n } from './helpers/i18n'
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
vi.mock('@/lib/dashboard/use-staff-role', () => ({ useStaffRole: () => h.role }))
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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), useParams: () => ({ id: '11' }) }))
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
    expect(options).toEqual(['All methods', 'Cheque', 'Demand draft', 'NEFT', 'RTGS', 'IMPS', 'UPI'])
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
    const dates = panel.querySelectorAll('input[type="date"]')
    await user.type(dates[0] as HTMLInputElement, '2026-03-01')
    await user.type(dates[1] as HTMLInputElement, '2026-03-31')
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
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('you can’t verify it')
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
