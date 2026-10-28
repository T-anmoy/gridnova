import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortalPayments from '@/components/associate/PortalPayments'
import RecordPaymentForm from '@/components/payments/RecordPaymentForm'
import { ApiError } from '@/lib/dashboard/api-error'
import { en, withI18n } from './helpers/i18n'
import { typeDateField } from './helpers/date-field'
import type { Milestone, Payment, PaymentInstructions, PaymentOverview } from '@/lib/associate/payment-types'

const copy = en.associates.portal.payments

const hooks = vi.hoisted(() => ({
  overview: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  instructions: {} as { data?: unknown; isLoading?: boolean },
  record: vi.fn(),
  proof: vi.fn(),
  cancel: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('@/lib/associate/payment-api-client', () => ({
  useCustomerPayments: () => ({ ...hooks.overview, refetch: hooks.refetch }),
  usePaymentInstructions: () => hooks.instructions,
  useRecordCustomerPayment: () => ({ mutateAsync: hooks.record }),
  useUploadPaymentProof: () => ({ mutateAsync: hooks.proof }),
  useCancelCustomerPayment: () => ({ mutateAsync: hooks.cancel, isPending: false }),
  fetchPaymentProofLink: vi.fn(),
}))
vi.mock('@/lib/associate/onboarding-api-client', () => ({ useOnboarding: () => ({ data: { customer: { name: 'Bikash Das' } } }) }))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }), useClerk: () => ({ signOut: vi.fn() }) }))

const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  milestone_id: 1,
  number: 1,
  label: 'On Order',
  percent: '20',
  amount_due: '100000.00',
  paid_toward: '0.00',
  outstanding: '100000.00',
  trigger: 'accepted',
  due_status: 'due',
  due_since: '2026-03-01T00:00:00Z',
  overdue: false,
  ...over,
})

const payment = (over: Partial<Payment> = {}): Payment => ({
  payment_id: 11,
  onboarding_id: 5,
  milestone_id: 1,
  amount: '100000.00',
  mode: 'neft',
  reference: 'UTR123',
  bank_name: null,
  instrument_date: null,
  payer_name: 'Asha',
  status: 'recorded',
  has_proof: false,
  proof_filename: null,
  recorded_by: 'GNA-1',
  recorded_at: '2026-03-02T10:00:00Z',
  deposited_at: null,
  verified_at: null,
  dishonoured_at: null,
  dishonour_reason: null,
  cancelled_at: null,
  cancel_reason: null,
  receipt: null,
  ...over,
})

const overview = (over: Partial<PaymentOverview> = {}): PaymentOverview => ({
  onboarding_id: 5,
  totals: { accepted_total: '500000.00', paid_verified: '0.00', awaiting_verification: '100000.00', balance: '500000.00' },
  milestones: [milestone(), milestone({ milestone_id: 2, number: 2, label: 'Against Material Bill', percent: '60', due_status: 'not_due', amount_due: '300000.00', outstanding: '300000.00' })],
  payments: [],
  enabled_modes: ['cheque', 'demand_draft', 'neft', 'rtgs', 'imps', 'upi'],
  proof_required: true,
  ...over,
})

const available: PaymentInstructions = {
  available: true,
  reason: null,
  message_key: null,
  account: { payee: 'Grid Nova Energy', bank_name: 'Test Bank', account_number: '1234567890', ifsc: 'TEST0001234' },
  cash_accepted: false,
}

function show() {
  return render(withI18n(<PortalPayments onboardingId={5} portalBase="/associates/portal" copy={copy} />))
}

beforeEach(() => {
  localStorage.clear()
  hooks.overview = { data: overview() }
  hooks.instructions = { data: available }
  hooks.record.mockReset()
  hooks.proof.mockReset()
  hooks.cancel.mockReset()
  hooks.refetch.mockReset()
})

describe('payment form conveniences', () => {
  it('pre-fills the payer with the customer\'s name', () => {
    show()
    expect(screen.getByLabelText(copy.payerName)).toHaveValue('Bikash Das')
  })

  it('keeps a half-filled form across a remount (refresh / back)', async () => {
    const user = userEvent.setup()
    const first = show()
    await user.type(screen.getByLabelText(copy.reference), 'UTR-KEEP')
    first.unmount()
    show()
    expect(screen.getByLabelText(copy.reference)).toHaveValue('UTR-KEEP')
  })

  it('clears the saved draft once the payment is recorded', async () => {
    hooks.record.mockResolvedValue({ payment: payment({ payment_id: 12 }), ...overview() })
    const user = userEvent.setup()
    const first = show()
    await user.selectOptions(screen.getByLabelText(copy.mode), 'upi')
    await user.type(screen.getByLabelText(copy.amount), '10')
    await user.type(screen.getByLabelText(copy.reference), 'UTR-GONE')
    await user.click(screen.getByRole('button', { name: copy.save }))
    await screen.findByTestId('proof-prompt')
    first.unmount()
    show()
    expect(screen.getByLabelText(copy.reference)).toHaveValue('')
  })
})

describe('payment instructions', () => {
  it('always shows the "never in cash, never to a person" banner, with the real account when available', () => {
    show()
    expect(screen.getByTestId('no-cash-banner')).toHaveTextContent(copy.banner)
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.queryByTestId('details-pending')).toBeNull()
  })

  it('renders NO account details at all while the backend says they are not available', () => {
    hooks.instructions = { data: { available: false, reason: 'placeholder_content', message_key: 'payments.details_pending', account: { payee: 'DUMMY', bank_name: 'DUMMY', account_number: 'DUMMY', ifsc: 'DUMMY' }, cash_accepted: false } }
    show()
    expect(screen.getByTestId('details-pending')).toHaveTextContent(copy.detailsPending)
    expect(screen.queryByText('DUMMY')).toBeNull()
    expect(screen.queryByText(copy.accountNumber)).toBeNull()
    expect(screen.getByTestId('no-cash-banner')).toBeInTheDocument()
  })
})

describe('instruction message keys', () => {
  it('translates payments.instructions.not_ready while details are not available (no account shown)', () => {
    hooks.instructions = { data: { available: false, reason: 'placeholder_content', message_key: 'payments.instructions.not_ready', account: null, cash_accepted: false } }
    show()
    expect(screen.getByTestId('details-pending')).toHaveTextContent(copy.instructionNotReady)
    expect(screen.queryByText(copy.accountNumber)).toBeNull()
  })

  it('translates payments.instructions.pay_only_here next to the real account', () => {
    hooks.instructions = { data: { ...available, message_key: 'payments.instructions.pay_only_here' } }
    show()
    expect(screen.getByTestId('instruction-message')).toHaveTextContent(copy.instructionPayOnlyHere)
  })

  it('shows no extra line, and the generic pending text, for an unknown key', () => {
    hooks.instructions = { data: { ...available, message_key: 'payments.instructions.brand_new' } }
    const { unmount } = show()
    expect(screen.queryByTestId('instruction-message')).toBeNull()
    unmount()
    hooks.instructions = { data: { available: false, reason: 'x', message_key: 'payments.instructions.brand_new', account: null, cash_accepted: false } }
    show()
    expect(screen.getByTestId('details-pending')).toHaveTextContent(copy.detailsPendingBody)
  })

  it('has both keys in Hindi and Bengali', async () => {
    const hi = (await import('@/messages/hi.json')).default.associates.portal.payments
    const bn = (await import('@/messages/bn.json')).default.associates.portal.payments
    for (const m of [hi, bn]) {
      expect(m.instructionNotReady).toBeTruthy()
      expect(m.instructionPayOnlyHere).toBeTruthy()
    }
  })
})

describe('what is due', () => {
  it('shows each milestone exactly as returned (no hard-coded 20/60/20), with a due chip and a collect prompt', () => {
    show()
    const items = screen.getAllByTestId('milestone')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('On Order')
    expect(items[0]).toHaveTextContent('20% of the total')
    expect(items[0]).toHaveTextContent('₹1,00,000.00')
    expect(within(items[0]).getByTestId('collect-this')).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('Against Material Bill')
    expect(items[1]).toHaveTextContent(copy.due.not_due)
    expect(within(items[1]).queryByTestId('collect-this')).toBeNull()
  })

  it('flags an overdue milestone and does not imply a per-milestone allocation', () => {
    hooks.overview = { data: overview({ milestones: [milestone({ overdue: true })] }) }
    show()
    expect(screen.getByText(copy.due.overdue)).toBeInTheDocument()
    expect(screen.getByText(copy.milestoneNote)).toBeInTheDocument()
  })

  it('shows server totals with Indian grouping and no arithmetic', () => {
    show()
    const totals = screen.getByTestId('totals')
    expect(totals).toHaveTextContent('₹5,00,000.00')
    expect(totals).toHaveTextContent('₹1,00,000.00')
  })
})

describe('recording a payment', () => {
  it('has no cash option anywhere in the form', () => {
    const { container } = show()
    const select = screen.getByLabelText(copy.mode) as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.textContent)
    expect(options).toEqual(['', 'Cheque', 'Demand draft', 'NEFT', 'RTGS', 'IMPS', 'UPI'])
    expect(options.join(' ').toLowerCase()).not.toContain('cash')
    // The one place "cash" appears on the page is the warning banner itself — never a control or a label.
    const controls = container.querySelectorAll('option, label, button, input')
    expect(Array.from(controls).filter((el) => /cash/i.test(el.textContent ?? '') || /cash/i.test((el as HTMLInputElement).value ?? ''))).toEqual([])
    expect(screen.getByTestId('no-cash-banner')).toHaveTextContent(/never in cash/)
  })

  it('offers only the modes the backend enables', () => {
    hooks.overview = { data: overview({ enabled_modes: ['upi', 'neft'] }) }
    show()
    const select = screen.getByLabelText(copy.mode) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'upi', 'neft'])
  })

  it('sends the amount as the exact string typed, then immediately prompts for proof', async () => {
    hooks.record.mockResolvedValue({ payment: payment({ payment_id: 12 }), ...overview() })
    const user = userEvent.setup()
    show()
    await user.selectOptions(screen.getByLabelText(copy.mode), 'neft')
    await user.type(screen.getByLabelText(copy.amount), '25000.50')
    await user.type(screen.getByLabelText(copy.reference), ' UTR999 ')
    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(hooks.record).toHaveBeenCalledWith({ amount: '25000.50', mode: 'neft', reference: 'UTR999', payer_name: 'Bikash Das' })
    expect(typeof hooks.record.mock.calls[0][0].amount).toBe('string')
    expect(await screen.findByTestId('proof-prompt')).toHaveTextContent(copy.proofTitle)
  })

  it('a cheque needs its bank and date, and sends the date', async () => {
    hooks.record.mockResolvedValue({ payment: payment(), ...overview() })
    const user = userEvent.setup()
    show()
    await user.selectOptions(screen.getByLabelText(copy.mode), 'cheque')
    await user.type(screen.getByLabelText(copy.amount), '1000')
    await user.type(screen.getByLabelText(copy.reference), '000123')
    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(hooks.record).not.toHaveBeenCalled()
    expect(screen.getAllByText(copy.required).length).toBeGreaterThanOrEqual(2)
    await user.type(screen.getByLabelText(new RegExp(copy.bankName)), 'SBI')
    await typeDateField(user, copy.instrumentDate, '05032026')
    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(hooks.record).toHaveBeenCalledWith(expect.objectContaining({ mode: 'cheque', bank_name: 'SBI', instrument_date: '2026-03-05' }))
  })

  it('rejects a malformed amount before calling the server', async () => {
    const user = userEvent.setup()
    show()
    await user.selectOptions(screen.getByLabelText(copy.mode), 'upi')
    await user.type(screen.getByLabelText(copy.amount), '1,000')
    await user.type(screen.getByLabelText(copy.reference), 'x')
    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(screen.getByText(copy.amountError)).toBeInTheDocument()
    expect(hooks.record).not.toHaveBeenCalled()
  })

  it.each([
    ['duplicate_payment_reference', copy.errors.duplicate_payment_reference],
    ['not_accepted', copy.errors.not_accepted],
    ['not_editable', copy.errors.not_editable],
    ['mode_not_enabled', copy.errors.mode_not_enabled],
    ['no_accepted_total', copy.errors.no_accepted_total],
  ])('explains %s in plain words', async (code, expected) => {
    hooks.record.mockRejectedValue(new ApiError(409, 'x', 'server text', { code }))
    const user = userEvent.setup()
    show()
    await user.selectOptions(screen.getByLabelText(copy.mode), 'upi')
    await user.type(screen.getByLabelText(copy.amount), '10')
    await user.type(screen.getByLabelText(copy.reference), 'x')
    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
  })

  it('explains exceeds_project_total with the server-provided figures, formatted but never calculated', async () => {
    hooks.record.mockRejectedValue(new ApiError(409, 'x', 'too much', { code: 'exceeds_project_total', accepted_total: '500000.00', already_recorded: '450000.00' }))
    const user = userEvent.setup()
    show()
    await user.selectOptions(screen.getByLabelText(copy.mode), 'upi')
    await user.type(screen.getByLabelText(copy.amount), '99999')
    await user.type(screen.getByLabelText(copy.reference), 'x')
    await user.click(screen.getByRole('button', { name: copy.save }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('₹5,00,000.00')
    expect(alert).toHaveTextContent('₹4,50,000.00')
  })
})

describe('the payment list', () => {
  it('shows status, milestone label, and a "Proof needed" chip with an Add proof action', () => {
    hooks.overview = { data: overview({ payments: [payment()] }) }
    show()
    const row = screen.getByTestId('payment-row')
    expect(row).toHaveTextContent('₹1,00,000.00')
    expect(row).toHaveTextContent(copy.status.recorded)
    expect(row).toHaveTextContent('For: On Order')
    expect(within(row).getByTestId('proof-needed')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: copy.addProof })).toBeInTheDocument()
  })

  it('shows the receipt link once verified, and a quiet "being prepared" note while a receipt is held', () => {
    const receipt = { receipt_number: 'GNR-2026-000001', email_status: 'sent', emailed_at: null, pdf_available: true, receipt_pending_email: false, held: false, url: 'https://x/receipt' }
    hooks.overview = { data: overview({ payments: [payment({ status: 'verified', has_proof: true, receipt })] }) }
    const { unmount } = show()
    expect(screen.getByRole('link', { name: /GNR-2026-000001/ })).toHaveAttribute('href', 'https://x/receipt')
    unmount()
    hooks.overview = { data: overview({ payments: [payment({ status: 'verified', has_proof: true, receipt: { ...receipt, held: true, url: null } })] }) }
    show()
    expect(screen.queryByRole('link', { name: /GNR-/ })).toBeNull()
    expect(screen.getByText(copy.receiptPending)).toBeInTheDocument()
  })

  it('shows "replaces bounced payment" for a re-recorded cheque, and the bounce reason', () => {
    hooks.overview = { data: overview({ payments: [payment({ previous_payment_id: 7 }), payment({ payment_id: 7, status: 'dishonoured', has_proof: true, dishonour_reason: 'Insufficient funds' })] }) }
    show()
    expect(screen.getByTestId('replaces')).toHaveTextContent('Replaces bounced payment #7')
    expect(screen.getByText('Reason: Insufficient funds')).toBeInTheDocument()
  })

  it('lets the owner cancel their own recorded payment with a reason, and refuses an empty reason', async () => {
    hooks.overview = { data: overview({ payments: [payment({ has_proof: true })] }) }
    hooks.cancel.mockResolvedValue(payment({ status: 'cancelled' }))
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('button', { name: copy.cancel }))
    await user.click(screen.getByRole('button', { name: copy.cancelConfirm }))
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors.reason_required)
    expect(hooks.cancel).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(copy.cancelReason), 'Wrong amount')
    await user.click(screen.getByRole('button', { name: copy.cancelConfirm }))
    expect(hooks.cancel).toHaveBeenCalledWith({ paymentId: 11, reason: 'Wrong amount' })
  })

  it('offers no cancel for verified payments', () => {
    hooks.overview = { data: overview({ payments: [payment({ status: 'verified', has_proof: true })] }) }
    show()
    expect(screen.queryByRole('button', { name: copy.cancel })).toBeNull()
  })
})

describe('load, error and ownership states', () => {
  it('shows a skeleton while loading', () => {
    hooks.overview = { isLoading: true }
    show()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('a plain 403 means "not this customer\'s owner" — a friendly message, no retry loop', () => {
    hooks.overview = { error: new ApiError(403, 'x', 'Only the owning associate can view payments.') }
    show()
    expect(screen.getByTestId('not-owner')).toHaveTextContent(copy.notOwner)
  })

  it('other failures show an error with Retry', async () => {
    hooks.overview = { error: new ApiError(500, 'x', 'boom') }
    show()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(hooks.refetch).toHaveBeenCalled()
  })

  it('a wrong-account 403 shows the wrong-account page, not the owner message', () => {
    hooks.overview = { error: new ApiError(403, 'x', 'This endpoint is for Grid Nova associates only.') }
    show()
    expect(screen.queryByTestId('not-owner')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong account')
  })
})

describe('RecordPaymentForm — shared with staff', () => {
  it('never lists cash even if it were passed in by mistake? (modes come only from the backend)', () => {
    render(
      withI18n(
        <RecordPaymentForm copy={copy} idPrefix="t" modes={['neft']} milestones={[]} onRecord={vi.fn()} onUploadProof={vi.fn()} />
      )
    )
    const options = Array.from((screen.getByLabelText(copy.mode) as HTMLSelectElement).options).map((o) => o.value)
    expect(options).toEqual(['', 'neft'])
    expect(screen.queryByLabelText(copy.milestone)).toBeNull()
  })

  it('uploads proof for the new payment through the proof slot', async () => {
    hooks.proof.mockResolvedValue({})
    const onRecord = vi.fn().mockResolvedValue(payment({ payment_id: 42 }))
    const onUploadProof = vi.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(withI18n(<RecordPaymentForm copy={copy} idPrefix="t" modes={['upi']} milestones={[]} onRecord={onRecord} onUploadProof={onUploadProof} />))
    await user.selectOptions(screen.getByLabelText(copy.mode), 'upi')
    await user.type(screen.getByLabelText(copy.amount), '500')
    await user.type(screen.getByLabelText(copy.reference), 'r1')
    await user.click(screen.getByRole('button', { name: copy.save }))
    const input = (await screen.findByTestId('proof-file-input')) as HTMLInputElement
    const pdf = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' })
    await user.upload(input, pdf)
    await waitFor(() => expect(onUploadProof).toHaveBeenCalledWith(42, pdf, expect.any(Function)))
    expect(await screen.findByText(copy.proofDone)).toBeInTheDocument()
  })
})

// FE-19 / BE-19 associate_journeys.md §5: cheque, NEFT, RTGS and IMPS only.
describe('payment methods after BE-19', () => {
  const BE19_MODES = ['cheque', 'neft', 'rtgs', 'imps']

  it('the form offers only the enabled methods', async () => {
    hooks.overview = { data: overview({ enabled_modes: BE19_MODES }) }
    hooks.instructions = { data: available }
    show()
    const options = within(screen.getByLabelText(copy.mode)).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual([expect.any(String), 'Cheque', 'NEFT', 'RTGS', 'IMPS'])
    expect(options).not.toContain('UPI')
    expect(options).not.toContain('Demand draft')
  })

  it('an older demand draft or UPI row stays as history, labelled no longer accepted', () => {
    hooks.overview = { data: overview({ enabled_modes: BE19_MODES, payments: [payment({ mode: 'upi' }), payment({ payment_id: 12, mode: 'neft' })] }) }
    show()
    const rows = screen.getAllByTestId('payment-row')
    expect(rows[0]).toHaveTextContent(`UPI (${copy.retiredMode})`)
    expect(within(rows[1]).queryByTestId('retired-mode')).toBeNull()
  })

  it('a 422 mode_not_enabled is a plain sentence', async () => {
    hooks.overview = { data: overview({ enabled_modes: BE19_MODES }) }
    hooks.instructions = { data: available }
    hooks.record.mockRejectedValueOnce(new ApiError(422, 'x', 'Demand draft is not accepted.', { code: 'mode_not_enabled' }))
    const user = userEvent.setup()
    show()
    await user.selectOptions(screen.getByLabelText(copy.mode), 'neft')
    await user.type(screen.getByLabelText(copy.amount), '1000')
    await user.type(screen.getByLabelText(copy.reference), 'UTR9')
    await user.click(screen.getByRole('button', { name: copy.save }))
    expect(await screen.findByText(copy.errors.mode_not_enabled)).toBeInTheDocument()
    expect(screen.queryByText('Demand draft is not accepted.')).toBeNull()
  })
})
