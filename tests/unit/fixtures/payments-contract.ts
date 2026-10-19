// Payment request/response shapes, taken from the backend contract
// (openapi.json `PaymentIn`; the 201 body has no published schema, so the
// response fixtures follow lib/associate/payment-types.ts and are checked
// against the zod/type shapes by the tests that use them).
import type { Payment, RecordPaymentInput, StaffPayment } from '@/lib/associate/payment-types'

/** POST …/onboardings/{id}/payments — body. `amount` is a decimal string, exactly as typed. */
export const PAYMENT_IN_CHEQUE: RecordPaymentInput = {
  amount: '25000.50',
  mode: 'cheque',
  reference: '000123',
  bank_name: 'State Bank of India',
  instrument_date: '2026-10-12',
  payer_name: 'Asha Roy',
  milestone_id: 7,
}

export const PAYMENT_IN_UPI: RecordPaymentInput = { amount: '1000', mode: 'upi', reference: 'UPI-REF-9' }

export const PAYMENT_FIXTURE: Payment = {
  payment_id: 41,
  onboarding_id: 12,
  milestone_id: 7,
  amount: '25000.50',
  mode: 'cheque',
  reference: '000123',
  bank_name: 'State Bank of India',
  instrument_date: '2026-10-12',
  payer_name: 'Asha Roy',
  status: 'recorded',
  has_proof: false,
  proof_filename: null,
  recorded_by: 'GNA-1',
  recorded_at: '2026-10-12T05:00:00Z',
  deposited_at: null,
  verified_at: null,
  dishonoured_at: null,
  dishonour_reason: null,
  cancelled_at: null,
  cancel_reason: null,
  receipt: null,
}

export const STAFF_PAYMENT_FIXTURE: StaffPayment = {
  ...PAYMENT_FIXTURE,
  deposited_by: null,
  verified_by: null,
  dishonoured_by: null,
  cancelled_by: null,
  needs_attention: false,
  attention_reasons: [],
}

/** The associate record-payment 201: the payment plus the refreshed overview. */
export const RECORD_PAYMENT_RESPONSE = {
  payment: PAYMENT_FIXTURE,
  onboarding_id: 12,
  totals: { accepted_total: '100000.00', paid_verified: '0.00', awaiting_verification: '25000.50', balance: '100000.00' },
  milestones: [],
  payments: [PAYMENT_FIXTURE],
  enabled_modes: ['cheque', 'demand_draft', 'neft', 'rtgs', 'imps', 'upi'],
  proof_required: true,
}
