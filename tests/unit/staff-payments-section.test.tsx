import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffPaymentsSection from '@/components/dashboard/StaffPaymentsSection'
import PaymentScheduleEditor from '@/components/dashboard/PaymentScheduleEditor'
import { ApiError } from '@/lib/dashboard/api-error'
import { withI18n } from './helpers/i18n'
import type { Milestone, StaffPayment } from '@/lib/associate/payment-types'

const h = vi.hoisted(() => ({
  overview: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  overviewCalls: 0,
  save: vi.fn(),
  record: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('@/lib/dashboard/payments-api-client', async (orig) => ({
  ...(await orig<typeof import('@/lib/dashboard/payments-api-client')>()),
  useStaffOnboardingPayments: () => ((h.overviewCalls += 1), { ...h.overview, refetch: h.refetch }),
  useRecordStaffPayment: () => ({ mutateAsync: h.record }),
  useUploadStaffPaymentProof: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/lib/dashboard/accounts-api-client', () => ({ useSavePaymentSchedule: () => ({ mutateAsync: h.save, isPending: false }) }))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }), useClerk: () => ({ signOut: vi.fn() }) }))

const ms = (over: Partial<Milestone>): Milestone => ({
  milestone_id: 1,
  number: 1,
  label: 'On Order',
  percent: '20',
  amount_due: '100000.00',
  paid_toward: '0.00',
  outstanding: '100000.00',
  trigger: 'accepted',
  due_status: 'due',
  due_since: null,
  overdue: false,
  ...over,
})
const milestones = [ms({}), ms({ milestone_id: 2, number: 2, label: 'Against Material Bill', percent: '60', amount_due: '300000.00', trigger: 'agreement_signed' }), ms({ milestone_id: 3, number: 3, label: 'Before Commissioning', percent: '20', trigger: 'installed' })]

const pay = (over: Partial<StaffPayment> = {}): StaffPayment =>
  ({
    payment_id: 11, onboarding_id: 5, milestone_id: 1, amount: '100000.00', mode: 'neft', reference: 'UTR1', bank_name: null, instrument_date: null, payer_name: null,
    status: 'recorded', has_proof: true, proof_filename: null, recorded_by: 'x', recorded_at: '2026-03-02T10:00:00Z', deposited_at: null, verified_at: null, dishonoured_at: null,
    dishonour_reason: null, cancelled_at: null, cancel_reason: null, receipt: null, deposited_by: null, verified_by: null, dishonoured_by: null, cancelled_by: null,
    needs_attention: false, attention_reasons: [], ...over,
  }) as StaffPayment

const overview = (over: Record<string, unknown> = {}) => ({
  onboarding_id: 5,
  totals: { accepted_total: '500000.00', paid_verified: '0.00', awaiting_verification: '100000.00', balance: '500000.00' },
  milestones,
  payments: [] as StaffPayment[],
  enabled_modes: ['neft', 'upi'],
  proof_required: true,
  project: { onboarding_id: 5, customer_name: 'Bikash Das' },
  ...over,
})

beforeEach(() => {
  h.overview = { data: overview() }
  h.overviewCalls = 0
  for (const f of [h.save, h.record, h.refetch]) f.mockReset()
})

const show = (role: Parameters<typeof StaffPaymentsSection>[0]['role']) => render(withI18n(<StaffPaymentsSection onboardingId={5} role={role} />))

describe('StaffPaymentsSection — role gating', () => {
  it.each(['operations', 'engineer', undefined] as const)('renders nothing and makes no payment request for %s', (role) => {
    const { container } = show(role)
    expect(container).toBeEmptyDOMElement()
    expect(h.overviewCalls).toBe(0)
  })

  it('sales can record but cannot edit the schedule or open the Accounts payment page', () => {
    show('sales')
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save schedule' })).toBeNull()
  })

  it('management reads only: no record form and no schedule editing', () => {
    show('management')
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save schedule' })).toBeNull()
    expect(screen.getByTestId('payment-totals')).toHaveTextContent('₹5,00,000.00')
  })

  it('accounts gets record + schedule save', () => {
    show('accounts')
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeEnabled()
  })
})

describe('StaffPaymentsSection — content', () => {
  it('shows payments with status, replaces-bounced note and attention chips, using server amounts', () => {
    h.overview = { data: overview({ payments: [pay({ previous_payment_id: 7, attention_reasons: ['proof_missing'], status: 'deposited' })] }) }
    show('accounts')
    const row = screen.getByTestId('section-payment')
    expect(row).toHaveTextContent('₹1,00,000.00')
    expect(row).toHaveTextContent('Deposited')
    expect(row).toHaveTextContent('replaces bounced payment #7')
    expect(row).toHaveTextContent('Proof missing')
    expect(within(row).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/dashboard/accounts/payments/11')
  })

  it('shows load error with Retry', async () => {
    h.overview = { error: new ApiError(500, 'x', 'boom') }
    show('accounts')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(h.refetch).toHaveBeenCalled()
  })
})

describe('PaymentScheduleEditor', () => {
  it('renders exactly what the API returned — no hard-coded labels, percents or triggers', () => {
    render(<PaymentScheduleEditor onboardingId={5} milestones={milestones} locked={false} canEdit />)
    expect(screen.getByLabelText('Instalment 1 label')).toHaveValue('On Order')
    expect(screen.getByLabelText('Instalment 2 label')).toHaveValue('Against Material Bill')
    expect(screen.getByLabelText('Instalment 2 percent')).toHaveValue('60')
    expect(screen.getByLabelText('Instalment 3 trigger')).toHaveValue('installed')
    expect(screen.queryByRole('button', { name: /add|remove|delete/i })).toBeNull()
  })

  it('saves the edited values as strings with the same number of instalments', async () => {
    h.save.mockResolvedValue({})
    const user = userEvent.setup()
    render(<PaymentScheduleEditor onboardingId={5} milestones={milestones} locked={false} canEdit />)
    const percent = screen.getByLabelText('Instalment 1 percent')
    await user.clear(percent)
    await user.type(percent, '25')
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))
    const body = h.save.mock.calls[0][0]
    expect(body.milestones).toHaveLength(3)
    expect(body.milestones[0]).toEqual({ label: 'On Order', percent: '25', trigger: 'accepted' })
    expect(await screen.findByRole('status')).toHaveTextContent('Schedule saved.')
  })

  it('is locked, with an explanation, once any non-cancelled payment exists', () => {
    render(<PaymentScheduleEditor onboardingId={5} milestones={milestones} locked canEdit />)
    expect(screen.getByTestId('schedule-locked')).toHaveTextContent('locked')
    expect(screen.getByLabelText('Instalment 1 label')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeDisabled()
  })

  it('explains invalid_schedule and schedule_locked from the server', async () => {
    h.save.mockRejectedValueOnce(new ApiError(422, 'x', 'bad', { code: 'invalid_schedule' })).mockRejectedValueOnce(new ApiError(409, 'x', 'locked', { code: 'schedule_locked' }))
    const user = userEvent.setup()
    render(<PaymentScheduleEditor onboardingId={5} milestones={milestones} locked={false} canEdit />)
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))
    expect(await screen.findByRole('status')).toHaveTextContent('percentages that total 100')
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))
    expect(await screen.findByText(/locked because payments have already been recorded/)).toBeInTheDocument()
  })

  it('is read-only for roles that cannot edit', () => {
    render(<PaymentScheduleEditor onboardingId={5} milestones={milestones} locked={false} canEdit={false} />)
    expect(screen.getByLabelText('Instalment 1 label')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save schedule' })).toBeNull()
  })
})
