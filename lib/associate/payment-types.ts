// Shapes of the payment endpoints, from the Phase 4A contract. Every amount is
// a decimal string and is displayed as returned (see lib/money.ts) — nothing
// here is ever added up or compared in the browser.

export type PaymentStatus = 'recorded' | 'deposited' | 'verified' | 'dishonoured' | 'cancelled'

// Modes are whatever `enabled_modes` says; there is deliberately no cash.
export type PaymentMode = string

export type DueStatus = 'not_due' | 'due' | 'partially_paid' | 'paid' | string

export interface Receipt {
  receipt_number: string
  email_status: string | null
  emailed_at: string | null
  pdf_available: boolean
  receipt_pending_email: boolean
  held: boolean
  url: string | null
}

export interface Milestone {
  milestone_id: number
  number: number
  label: string
  percent: string | number
  amount_due: string
  paid_toward: string
  outstanding: string
  trigger: string | null
  due_status: DueStatus
  due_since: string | null
  overdue: boolean
  // Staff list/queue items only. May be null — use project_id for routes and links.
  onboarding_id?: number | null
  project_id?: number | null
  needs_attention?: boolean
}

export interface PaymentTotals {
  accepted_total: string
  paid_verified: string
  awaiting_verification: string
  balance: string
}

export interface Payment {
  payment_id: number
  // May be null (a payment not tied to an onboarding): never assume it in routes.
  onboarding_id: number | null
  project_id?: number | null
  milestone_id: number | null
  amount: string
  mode: PaymentMode
  reference: string
  bank_name: string | null
  instrument_date: string | null
  payer_name: string | null
  status: PaymentStatus
  has_proof: boolean
  proof_filename: string | null
  recorded_by: string | null
  recorded_at: string
  deposited_at: string | null
  verified_at: string | null
  dishonoured_at: string | null
  dishonour_reason: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  receipt: Receipt | null
  // A cheque re-recorded after a dishonour.
  previous_payment_id?: number | null
}

// Staff view adds who acted and why it needs attention.
export interface StaffPayment extends Payment {
  deposited_by: string | null
  verified_by: string | null
  dishonoured_by: string | null
  cancelled_by: string | null
  needs_attention: boolean
  attention_reasons: string[]
  receipt:
    | (Receipt & { email_skipped_reason?: string | null; held_reason?: string | null; render_error?: string | null })
    | null
}

export interface PaymentOverview<P = Payment> {
  onboarding_id: number | null
  totals: PaymentTotals
  milestones: Milestone[]
  payments: P[]
  enabled_modes: PaymentMode[]
  proof_required: boolean
}

export interface RecordPaymentResponse<P = Payment> extends PaymentOverview<P> {
  payment: P
}

export interface RecordPaymentInput {
  // Sent as a decimal string, exactly as typed.
  amount: string
  mode: PaymentMode
  reference: string
  bank_name?: string
  instrument_date?: string
  payer_name?: string
  milestone_id?: number
}

export interface PaymentInstructions {
  available: boolean
  reason: string | null
  message_key: string | null
  account: { payee: string; bank_name: string; account_number: string; ifsc: string } | null
  cash_accepted: false
}
