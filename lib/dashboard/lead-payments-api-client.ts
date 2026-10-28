import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Milestone, RecordPaymentInput, StaffPayment } from '@/lib/associate/payment-types'
import type { PaymentProject } from './payments-api-client'

// A direct customer's payments (docs/api/direct_payments.md, BE-20): a lead with no associate.
// The same payment JSON and shared /payments/{id}/… action routes as an associate customer's;
// only the overview, record and receipt routes are keyed by lead. Money is shown as returned.
const BASE = '/api/v1/dashboard'

// Before the customer accepts, every total is null except paid_verified.
export interface LeadPaymentTotals {
  accepted_total: string | null
  paid_verified: string
  awaiting_verification: string | null
  balance: string | null
}

export interface LeadPaymentOverview {
  onboarding_id: null
  lead_id: number
  proposal_id: number | null
  totals: LeadPaymentTotals
  milestones: Milestone[]
  payments: StaffPayment[]
  enabled_modes: string[]
  proof_required: boolean
  project: PaymentProject
}

/** GET …/leads/{id}/payments/{payment_id}/receipt (staff view). */
export interface LeadReceipt {
  payment_id: number
  receipt_number: string
  email_status: string | null
  emailed_at: string | null
  pdf_available: boolean
  receipt_pending_email: boolean
  held: boolean
  voided: boolean
  // The customer's own link; null while held or void.
  url: string | null
  email_skipped_reason: string | null
  held_reason: string | null
  render_error: string | null
  voided_at: string | null
  void_reason: string | null
  // Short-lived signed link to the PDF; null while held or not rendered yet.
  pdf_url: string | null
  pdf_url_expires_at: string | null
}

/** 409 `associate_customer`: the lead was brought by an associate — its payments are on the onboarding. */
export function associateCustomerOnboarding(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 409 || err.structuredDetail?.code !== 'associate_customer') return null
  const id = err.structuredDetail.onboarding_id
  return typeof id === 'number' ? id : null
}

export const leadPaymentsKey = (leadId: number) => ['lead-payments', leadId] as const

export function useLeadPayments(leadId: number, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: leadPaymentsKey(leadId),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<LeadPaymentOverview>(`${BASE}/leads/${leadId}/payments`, token)
    },
    enabled: enabled && !!leadId,
    // A 409 (associate customer) or 403 is an answer, not a blip.
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
  })
}

// 201 returns the payment JSON plus `project`.
export function useRecordLeadPayment(leadId: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<StaffPayment & { project: PaymentProject }>(`${BASE}/leads/${leadId}/payments`, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadPaymentsKey(leadId) })
      void qc.invalidateQueries({ queryKey: ['staff-payments-list'] })
      void qc.invalidateQueries({ queryKey: ['staff-milestones'] })
      void qc.invalidateQueries({ queryKey: ['work-queues'] })
    },
  })
}

export async function fetchLeadReceipt(leadId: number, paymentId: number, token: string): Promise<LeadReceipt> {
  return dashboardFetch<LeadReceipt>(`${BASE}/leads/${leadId}/payments/${paymentId}/receipt`, token)
}
