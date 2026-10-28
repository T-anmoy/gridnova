// FE-20: a direct customer's payments on the lead's Payments tab (docs/api/direct_payments.md).
// Who sees and does what, the schedule and totals exactly as the server sends them, the record
// form's rules and every error code in plain words, the second-pair-of-eyes rule, held / ready /
// void receipts, the associate-customer 409 and the ?tab=payments deep link.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { navState } from './helpers/mock-navigation'
import { withI18n } from './helpers/i18n'
import { fillDateField } from './helpers/date-field'
import { ApiError } from '@/lib/dashboard/api-error'
import LeadPaymentsTab from '@/components/dashboard/LeadPaymentsTab'
import LeadDetailPage from '@/app/(internal)/dashboard/leads/[id]/page'
import type { LeadPaymentOverview } from '@/lib/dashboard/lead-payments-api-client'
import type { Milestone, StaffPayment } from '@/lib/associate/payment-types'
import type { LeadDetail } from '@/lib/dashboard/types'

const h = vi.hoisted(() => ({
  role: 'accounts' as string,
  userId: 'user_accounts_a',
  overview: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  overviewCalls: [] as number[],
  record: vi.fn(),
  receipt: vi.fn(),
  verify: vi.fn(),
  deposit: vi.fn(),
  dishonour: vi.fn(),
  cancel: vi.fn(),
  resend: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { id: h.userId, publicMetadata: { role: h.role } }, isLoaded: true }),
  useAuth: () => ({ getToken: async () => 'tok', userId: h.userId }),
  useClerk: () => ({ signOut: vi.fn() }),
}))
vi.mock('next/navigation', async () => {
  const nav = (await import('./helpers/mock-navigation')).navigationMock
  return { ...nav, useParams: () => ({ id: '12' }) }
})
vi.mock('@/lib/dashboard/lead-payments-api-client', async (orig) => ({
  ...(await orig<object>()),
  useLeadPayments: (id: number) => (h.overviewCalls.push(id), { ...h.overview, refetch: vi.fn() }),
  useRecordLeadPayment: () => ({ mutateAsync: h.record }),
  fetchLeadReceipt: (...a: unknown[]) => h.receipt(...a),
}))
vi.mock('@/lib/dashboard/accounts-api-client', () => ({
  useDepositPayment: () => ({ mutateAsync: h.deposit, isPending: false }),
  useVerifyPayment: () => ({ mutateAsync: h.verify }),
  useDishonourPayment: () => ({ mutateAsync: h.dishonour }),
  useCancelStaffPayment: () => ({ mutateAsync: h.cancel }),
  useResendReceipt: () => ({ mutateAsync: h.resend, isPending: false }),
}))
vi.mock('@/lib/dashboard/payments-api-client', async (orig) => ({
  ...(await orig<object>()),
  useUploadStaffPaymentProof: () => ({ mutateAsync: h.upload }),
}))

const milestone = (over: Partial<Milestone>): Milestone => ({
  milestone_id: 7, number: 1, label: 'On Order', percent: '20.00', amount_due: '54450.00', paid_toward: '54450.00', outstanding: '0.00',
  trigger: 'accepted', due_status: 'paid', due_since: '2026-10-01T00:00:00+05:30', overdue: false, ...over,
})

const payment = (over: Partial<StaffPayment> = {}): StaffPayment => ({
  payment_id: 31, onboarding_id: null, lead_id: 12, milestone_id: null, amount: '54450.00', mode: 'neft', reference: 'UTR0001',
  bank_name: null, instrument_date: null, payer_name: 'Ramesh Das', status: 'recorded', has_proof: true, proof_filename: 'p.pdf',
  recorded_by: 'user_accounts_b', recorded_at: '2026-10-20T10:00:00Z', deposited_at: null, verified_at: null, dishonoured_at: null,
  dishonour_reason: null, cancelled_at: null, cancel_reason: null, receipt: null, deposited_by: null, verified_by: null,
  dishonoured_by: null, cancelled_by: null, needs_attention: false, attention_reasons: [], ...over,
})

const overview = (over: Partial<LeadPaymentOverview> = {}): LeadPaymentOverview => ({
  onboarding_id: null, lead_id: 12, proposal_id: 40,
  totals: { accepted_total: '272250.00', paid_verified: '54450.00', awaiting_verification: '0.00', balance: '217800.00' },
  milestones: [
    milestone({}),
    milestone({ milestone_id: 8, number: 2, label: 'Against Material Bill', percent: '60.00', amount_due: '163350.00', paid_toward: '0.00', outstanding: '163350.00', trigger: 'material', due_status: 'not_due', due_since: null }),
    milestone({ milestone_id: 9, number: 3, label: 'Before Commissioning', percent: '20.00', amount_due: '54450.00', paid_toward: '0.00', outstanding: '54450.00', trigger: 'commissioning', due_status: 'not_due', due_since: null }),
  ],
  payments: [
    payment({ payment_id: 33, amount: '10000.00', reference: 'UTR-NEWEST' }),
    payment({ payment_id: 32, status: 'verified', verified_at: '2026-10-21T10:00:00Z', verified_by: 'user_accounts_a', receipt: { receipt_number: 'GNR-2026-00007', email_status: 'held', emailed_at: null, pdf_available: false, receipt_pending_email: false, held: true, voided: false, url: null } }),
  ],
  enabled_modes: ['cheque', 'neft', 'rtgs', 'imps'],
  proof_required: false,
  project: { onboarding_id: null, lead_id: 12, customer_name: 'Ramesh Das', customer_email: 'r@x.in', project_reference_id: 'GNE-WB-RES-2026-00012', current_stage: null, accepted_total: '272250.00', paid_verified: '54450.00', awaiting_verification: '0.00', balance: '217800.00' },
  ...over,
})

const renderTab = () => render(withI18n(<LeadPaymentsTab leadId={12} />))

beforeEach(() => {
  h.role = 'accounts'
  h.userId = 'user_accounts_a'
  h.overview = { data: overview(), isLoading: false, error: null }
  h.overviewCalls = []
  for (const f of [h.record, h.receipt, h.verify, h.deposit, h.dishonour, h.cancel, h.resend, h.upload]) f.mockReset()
  localStorage.clear()
  navState.reset('/dashboard/leads/12')
})

describe('the schedule, totals and payments are the server’s', () => {
  it('shows totals, each milestone (label, percent, due, paid toward, outstanding, due chip) and payments newest first', () => {
    renderTab()
    const totals = screen.getByTestId('lead-payment-totals')
    expect(totals).toHaveTextContent('Accepted total₹2,72,250.00')
    expect(totals).toHaveTextContent('Verified₹54,450.00')
    expect(totals).toHaveTextContent('Awaiting verification₹0.00')
    expect(totals).toHaveTextContent('Balance₹2,17,800.00')
    const ms = screen.getAllByTestId('lead-milestone')
    expect(ms).toHaveLength(3)
    expect(ms[0]).toHaveTextContent('1. On Order20.00%Paid')
    expect(ms[1]).toHaveTextContent('2. Against Material Bill60.00%Not due yet')
    expect(ms[1]).toHaveTextContent('Amount due₹1,63,350.00Paid toward₹0.00Outstanding₹1,63,350.00')
    const rows = screen.getAllByTestId('lead-payment')
    expect(rows[0]).toHaveTextContent('UTR-NEWEST')
    expect(rows[1]).toHaveTextContent('verified')
    expect(rows[1]).toHaveTextContent('by user_accounts_a')
  })

  it('flags an overdue advance with its due date', () => {
    h.overview = { data: overview({ milestones: [milestone({ due_status: 'due', paid_toward: '0.00', outstanding: '54450.00', overdue: true })] }) }
    renderTab()
    expect(screen.getByTestId('due-chip')).toHaveTextContent('Due')
    expect(screen.getByTestId('overdue-chip')).toHaveTextContent('Overdue (due since')
  })

  it('before acceptance: a calm note and nothing to record', () => {
    h.overview = { data: overview({ milestones: [], payments: [], totals: { accepted_total: null, paid_verified: '0.00', awaiting_verification: null, balance: null } }) }
    renderTab()
    expect(screen.getByTestId('lead-payments-not-started')).toHaveTextContent('Payments start when the customer accepts the proposal')
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull()
  })

  it('an associate’s customer (409 associate_customer) links to that customer’s onboarding payments', () => {
    h.overview = { error: new ApiError(409, 'x', 'English text', { code: 'associate_customer', onboarding_id: 31 }) }
    renderTab()
    const card = screen.getByTestId('lead-associate-customer')
    expect(card).toHaveTextContent('brought by an associate')
    expect(within(card).getByRole('link', { name: 'Open the customer’s payments' })).toHaveAttribute('href', '/dashboard/onboardings/31#payments')
    expect(card).not.toHaveTextContent('English text')
  })

  it('Sales on someone else’s lead (403) sees the refusal, no payments', () => {
    h.role = 'sales'
    h.overview = { error: new ApiError(403, 'x', 'Not your lead') }
    renderTab()
    expect(screen.queryByTestId('lead-payments')).toBeNull()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('who may act', () => {
  it.each([
    ['accounts', true],
    ['admin', true],
    ['management', false],
    ['sales', false],
  ])('%s: record form and actions %s', (role, acts) => {
    h.role = role
    renderTab()
    expect(screen.getByTestId('lead-payments')).toBeInTheDocument()
    expect(!!screen.queryByRole('button', { name: 'Record payment' })).toBe(acts)
    expect(screen.queryAllByRole('button', { name: 'Actions' }).length > 0).toBe(acts)
    expect(!!screen.queryByRole('button', { name: 'Resend' })).toBe(false) // held receipt: nothing to resend
  })
})

describe('recording a payment', () => {
  it('a fully paid customer (every milestone paid, per the server) has nothing more to record', () => {
    h.overview = { data: overview({ milestones: [milestone({}), milestone({ milestone_id: 8, number: 2 })] }) }
    renderTab()
    expect(screen.getByTestId('lead-fully-paid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull()
  })

  async function fill(user: ReturnType<typeof userEvent.setup>, mode = 'neft', amount = '10000', reference = 'UTR123') {
    await user.selectOptions(screen.getByLabelText('How did the customer pay?'), mode)
    await user.type(screen.getByLabelText('Amount (₹)'), amount)
    await user.type(screen.getByLabelText('UTR / cheque / reference number'), reference)
  }

  it('offers only enabled_modes — no cash, UPI or demand draft', () => {
    renderTab()
    const options = within(screen.getByLabelText('How did the customer pay?')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value).filter(Boolean)
    expect(options).toEqual(['cheque', 'neft', 'rtgs', 'imps'])
  })

  it('validates before sending: method, amount shape, reference; a cheque needs bank and date', async () => {
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(2)
    await user.selectOptions(screen.getByLabelText('How did the customer pay?'), 'cheque')
    await user.type(screen.getByLabelText('Amount (₹)'), '12.345')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(screen.getByText('Enter a positive amount with at most 2 decimal places.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Customer's bank/)).toHaveAccessibleName(/Required/)
    expect(h.record).not.toHaveBeenCalled()
  })

  it('sends the amount as typed, the cheque details and the milestone label', async () => {
    h.record.mockResolvedValue(payment({ payment_id: 40 }))
    const user = userEvent.setup()
    renderTab()
    await fill(user, 'cheque', '54450.00', '000123')
    await user.type(screen.getByLabelText(/Customer's bank/), 'SBI')
    fillDateField('Cheque date', '2026-10-25')
    await user.selectOptions(screen.getByLabelText(/Which instalment/), '8')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    await waitFor(() => expect(h.record).toHaveBeenCalled())
    expect(h.record).toHaveBeenCalledWith({ amount: '54450.00', mode: 'cheque', reference: '000123', bank_name: 'SBI', instrument_date: '2026-10-25', payer_name: 'Ramesh Das', milestone_id: 8 })
  })

  it.each([
    ['exceeds_outstanding', { outstanding: '217800.00', accepted_total: '272250.00', already_recorded: '54450.00' }, 'Outstanding: ₹2,17,800.00'],
    ['duplicate_payment_reference', {}, 'already been recorded for this payment method and bank'],
    ['date_in_future', {}, 'The cheque date can’t be later than today.'],
    ['not_accepted', {}, 'Payments start when the customer accepts the proposal'],
    ['mode_not_enabled', {}, 'That payment method isn\'t accepted'],
    ['reference_required', {}, 'Please enter the reference number.'],
    ['instrument_details_required', {}, 'For a cheque, please enter the bank and the date on it.'],
    ['no_accepted_total', {}, 'no priced total yet'],
    ['unknown_milestone', {}, 'isn\'t part of this customer\'s schedule'],
  ])('%s is said in plain words', async (code, extra, text) => {
    h.record.mockRejectedValue(new ApiError(code.startsWith('exceeds') || code.startsWith('duplicate') || code.startsWith('not_') || code.startsWith('no_') ? 409 : 422, 'x', 'Server English', { code, ...extra }))
    const user = userEvent.setup()
    renderTab()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(text)
    expect(alert).not.toHaveTextContent('Server English')
  })
})

describe('verification: a second pair of eyes', () => {
  const own = () => overview({ payments: [payment({ recorded_by: 'user_accounts_a' })] })

  it('Accounts who recorded the payment is told why and cannot verify it', async () => {
    h.overview = { data: own() }
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByTestId('self-verification-note')).toHaveTextContent('You recorded this payment, so another Accounts person must verify it.')
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
  })

  it('another Accounts person verifies it', async () => {
    h.verify.mockResolvedValue(payment({ status: 'verified' }))
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getAllByRole('button', { name: 'Actions' })[0])
    expect(screen.queryByTestId('self-verification-note')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(h.verify).toHaveBeenCalledWith({ paymentId: 33, reason: undefined }))
  })

  it('an Admin may verify their own record, only with a reason', async () => {
    h.role = 'admin'
    h.overview = { data: own() }
    h.verify.mockResolvedValue(payment({ status: 'verified' }))
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByTestId('self-verification-note')).toHaveTextContent('As an Admin you may still verify it, with a reason.')
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Verify as admin' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Second accountant on leave; statement checked')
    await user.click(confirm)
    await waitFor(() => expect(h.verify).toHaveBeenCalledWith({ paymentId: 31, reason: 'Second accountant on leave; statement checked' }))
  })

  it('a 409 self_verification from the server is explained even when the record named someone else', async () => {
    h.verify.mockRejectedValue(new ApiError(409, 'x', 'English', { code: 'self_verification' }))
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getAllByRole('button', { name: 'Actions' })[0])
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verify' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('another Accounts person must verify it')
  })

  it('dishonour needs a reason; a re-presented cheque names the bounced one', async () => {
    h.overview = { data: overview({ payments: [payment({ payment_id: 35, mode: 'cheque', bank_name: 'SBI', previous_payment_id: 34 }), payment({ payment_id: 34, mode: 'cheque', status: 'dishonoured', dishonour_reason: 'Insufficient funds' })] }) }
    h.dishonour.mockResolvedValue(payment({ status: 'dishonoured' }))
    const user = userEvent.setup()
    renderTab()
    const [fresh, bounced] = screen.getAllByTestId('lead-payment')
    expect(fresh).toHaveTextContent('Re-presents bounced payment #34')
    expect(bounced).toHaveTextContent('Dishonoured: Insufficient funds')
    await user.click(within(fresh).getByRole('button', { name: 'Actions' }))
    expect(within(fresh).getByRole('button', { name: 'Mark deposited' })).toBeInTheDocument()
    await user.click(within(fresh).getByRole('button', { name: 'Dishonour' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Dishonour' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Bounced again')
    await user.click(within(dialog).getByRole('button', { name: 'Dishonour' }))
    await waitFor(() => expect(h.dishonour).toHaveBeenCalledWith({ paymentId: 35, reason: 'Bounced again' }))
  })

  it('a payment without proof offers the proof upload to Accounts', async () => {
    h.overview = { data: overview({ payments: [payment({ has_proof: false })] }) }
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(within(screen.getByTestId('lead-payment-actions')).getByText(/Attach proof of payment/)).toBeInTheDocument()
  })
})

describe('receipts', () => {
  const verified = (receipt: StaffPayment['receipt'], over: Partial<StaffPayment> = {}) =>
    overview({ payments: [payment({ status: 'verified', verified_by: 'user_accounts_b', receipt, ...over })] })

  it('while the wording (P6) is unsupplied, the receipt is numbered and held', () => {
    renderTab()
    expect(screen.getByTestId('receipt-held')).toHaveTextContent(
      'Receipt numbered GNR-2026-00007 — held until Grid Nova approves the receipt wording; it will be sent automatically then.',
    )
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })

  it('once released: download fetches a fresh signed link, copy gives the customer’s link, Accounts can resend', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    h.overview = { data: verified({ receipt_number: 'GNR-2026-00008', email_status: 'sent', emailed_at: null, pdf_available: true, receipt_pending_email: false, held: false, voided: false, url: 'https://api.example.test/api/v1/public/receipts/tok/pdf' }) }
    h.receipt.mockResolvedValue({ pdf_url: 'https://r2.example.test/signed?x=1' })
    h.resend.mockResolvedValue({})
    const user = userEvent.setup()
    // After setup(): user-event installs its own clipboard stub.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    renderTab()
    const ready = screen.getByTestId('receipt-ready')
    await user.click(within(ready).getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://r2.example.test/signed?x=1', '_blank', 'noopener'))
    expect(h.receipt).toHaveBeenCalledWith(12, 31, 'tok')
    await user.click(within(ready).getByRole('button', { name: 'Copy customer’s link' }))
    expect(writeText).toHaveBeenCalledWith('https://api.example.test/api/v1/public/receipts/tok/pdf')
    await user.click(within(ready).getByRole('button', { name: 'Resend' }))
    await waitFor(() => expect(h.resend).toHaveBeenCalledWith({ paymentId: 31 }))
    open.mockRestore()
  })

  it('Management can download but not resend', () => {
    h.role = 'management'
    h.overview = { data: verified({ receipt_number: 'GNR-2026-00008', email_status: 'sent', emailed_at: null, pdf_available: true, receipt_pending_email: false, held: false, voided: false, url: 'https://x/pdf' }) }
    renderTab()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resend' })).toBeNull()
  })

  it('a dishonoured payment’s receipt is void', () => {
    h.overview = { data: verified({ receipt_number: 'GNR-2026-00009', email_status: 'held', emailed_at: null, pdf_available: false, receipt_pending_email: false, held: true, voided: true, url: null }, { status: 'dishonoured' }) }
    renderTab()
    expect(screen.getByTestId('receipt-void')).toHaveTextContent('Receipt GNR-2026-00009 is void')
    expect(screen.queryByTestId('receipt-held')).toBeNull()
  })
})

// ── The tab on the lead page ──────────────────────────────────────────────

const LEAD: LeadDetail = {
  lead_id: 12,
  customer: { id: 3, name: 'Ramesh Das', email: 'r@x.in', company: null },
  pipeline_stage: 'won',
  lead_score: null,
  collected_fields: {},
  proposals: [],
  timeline: [{ event_type: 'payment_verified', description: 'Payment of INR 54450.00 verified', created_at: '2026-10-21T10:00:00Z' }],
  messages: [],
  assigned_employee_id: 'user_sales_1',
} as LeadDetail

vi.mock('@/lib/dashboard/staff-leads-api-client', async () => (await import('./helpers/staff-leads-mocks')).staffLeadsApiMock)
vi.mock('@/lib/dashboard/api-client', async (orig) => ({
  ...(await orig<object>()),
  useLead: () => ({ data: LEAD, isLoading: false, error: null, refetch: vi.fn() }),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeLeadStage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReassignLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateLeadFields: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssignableEmployees: () => ({ data: [], isLoading: false }),
}))

describe('lead page: the Payments tab', () => {
  beforeEach(() => {
    h.role = 'sales'
    h.userId = 'user_sales_1'
  })

  it('the alert email link (?tab=payments) opens straight on the Payments tab', () => {
    navState.reset('/dashboard/leads/12', 'tab=payments')
    render(withI18n(<LeadDetailPage />))
    expect(screen.getByRole('button', { name: 'Payments', pressed: true })).toBeInTheDocument()
    expect(screen.getByTestId('lead-payments')).toBeInTheDocument()
    expect(h.overviewCalls).toContain(12)
  })

  it('opens on Overview, and the Payments button switches tab through the URL', async () => {
    const user = userEvent.setup()
    render(withI18n(<LeadDetailPage />))
    expect(screen.getByRole('button', { name: 'Overview', pressed: true })).toBeInTheDocument()
    expect(screen.queryByTestId('lead-payments')).toBeNull()
    expect(h.overviewCalls).toEqual([])
    expect(screen.getByText('payment verified')).toBeInTheDocument() // the new timeline event type reads plainly
    await user.click(screen.getByRole('button', { name: 'Payments' }))
    expect(navState.params.get('tab')).toBe('payments')
    expect(await screen.findByTestId('lead-payments')).toBeInTheDocument()
  })

  it.each(['admin', 'management', 'sales'])('%s gets the tab beside the lead', (role) => {
    h.role = role
    render(withI18n(<LeadDetailPage />))
    expect(screen.getByTestId('lead-tabs')).toBeInTheDocument()
  })

  it('Accounts (no lead permission, BE-17) opening the alert link gets the lead’s Payments alone — never a no-access page', () => {
    h.role = 'accounts'
    render(withI18n(<LeadDetailPage />))
    expect(screen.getByTestId('lead-payments-only')).toHaveTextContent('Lead #12 — Payments')
    expect(screen.getByTestId('lead-payments-customer')).toHaveTextContent('Ramesh Das · GNE-WB-RES-2026-00012')
    expect(screen.queryByTestId('lead-tabs')).toBeNull()
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeInTheDocument()
  })

  it('Operations gets no tab, and ?tab=payments never fetches payments for them', () => {
    h.role = 'operations'
    navState.reset('/dashboard/leads/12', 'tab=payments')
    render(withI18n(<LeadDetailPage />))
    expect(screen.queryByTestId('lead-tabs')).toBeNull()
    expect(screen.queryByTestId('lead-payments')).toBeNull()
    expect(h.overviewCalls).toEqual([])
  })
})
