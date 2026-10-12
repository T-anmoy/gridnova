import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { apiDownload } from '@/lib/api/http'
import type { FileLinkResponse } from '@/lib/associate/onboarding-types'
import type { Milestone, PaymentTotals, StaffMilestone, StaffPayment } from '@/lib/associate/payment-types'
import type { PaymentProject } from './payments-api-client'

// Accounts workspace endpoints (/api/v1/dashboard). Roles: admin + accounts do
// everything; management reads; sales reads own/unassigned and records. Money
// fields are shown exactly as returned — nothing is added or compared here.
const BASE = '/api/v1/dashboard'

export interface Paginated<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}

export interface PaymentListParams {
  status?: string
  mode?: string
  needs_attention?: boolean
  onboarding_id?: number
  date_from?: string
  date_to?: string
  // Customer name, payment reference, project reference or receipt number
  // (backend search, ≤ 100 chars, applied before paging).
  q?: string
  page?: number
  page_size?: number
}

export interface PaymentDetail extends StaffPayment {
  project: PaymentProject
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

function useStaffGet<T>(key: unknown[], path: string, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<T>(path, token)
    },
    enabled,
    staleTime: 30_000,
  })
}

export const usePaymentList = (params: PaymentListParams) =>
  useStaffGet<Paginated<StaffPayment>>(['staff-payments-list', params], `${BASE}/payments${qs(params as Record<string, string | number | boolean | undefined>)}`)

export const useMilestoneQueue = (params: { needs_attention?: boolean; page?: number; page_size?: number }) =>
  useStaffGet<Paginated<StaffMilestone>>(['staff-milestones', params], `${BASE}/payment-milestones${qs(params)}`)

export const usePaymentDetail = (paymentId: number) => useStaffGet<PaymentDetail>(['staff-payment', paymentId], `${BASE}/payments/${paymentId}`, !!paymentId)

export interface PaymentSchedule {
  onboarding_id: number
  totals: PaymentTotals
  milestones: Milestone[]
}

export const usePaymentSchedule = (onboardingId: number, enabled = true) =>
  useStaffGet<PaymentSchedule>(['staff-payment-schedule', onboardingId], `${BASE}/onboardings/${onboardingId}/payment-schedule`, enabled && !!onboardingId)

function useAction<TInput, TOut>(run: (token: string, input: TInput) => Promise<TOut>) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return run(token, input)
    },
    onSuccess: () => {
      for (const key of ['staff-payments-list', 'staff-payment', 'staff-payments', 'staff-milestones', 'staff-payment-schedule', 'work-queues'])
        void qc.invalidateQueries({ queryKey: [key] })
    },
  })
}

const post = <T,>(path: string, token: string, body?: unknown) =>
  dashboardFetch<T>(path, token, { method: 'POST', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })

export const useDepositPayment = () => useAction<{ paymentId: number }, StaffPayment>((t, { paymentId }) => post(`${BASE}/payments/${paymentId}/deposit`, t))
// `reason` is optional, and mandatory for an Admin verifying a payment they recorded themselves.
export const useVerifyPayment = () =>
  useAction<{ paymentId: number; reason?: string }, StaffPayment>((t, { paymentId, reason }) => post(`${BASE}/payments/${paymentId}/verify`, t, reason ? { reason } : {}))
export const useDishonourPayment = () => useAction<{ paymentId: number; reason: string }, StaffPayment>((t, { paymentId, reason }) => post(`${BASE}/payments/${paymentId}/dishonour`, t, { reason }))
export const useCancelStaffPayment = () => useAction<{ paymentId: number; reason: string }, StaffPayment>((t, { paymentId, reason }) => post(`${BASE}/payments/${paymentId}/cancel`, t, { reason }))
export const useResendReceipt = () => useAction<{ paymentId: number }, unknown>((t, { paymentId }) => post(`${BASE}/payments/${paymentId}/receipt/resend`, t))
export const useReleaseHeldReceipts = () =>
  useAction<void, { released: number; still_held: number; reason: string | null }>((t) => post(`${BASE}/payment-receipts/release-held`, t))

export const useSavePaymentSchedule = (onboardingId: number) =>
  useAction<{ milestones: { label: string; percent: string | number; trigger: string | null }[] }, PaymentSchedule>(async (token, body) =>
    dashboardFetch<PaymentSchedule>(`${BASE}/onboardings/${onboardingId}/payment-schedule`, token, { method: 'PUT', body: JSON.stringify(body) })
  )

export async function fetchStaffPaymentProofLink(paymentId: number, token: string): Promise<FileLinkResponse> {
  return dashboardFetch(`${BASE}/payments/${paymentId}/proof`, token)
}

// Authenticated CSV download as a blob (never a bare link: the endpoint needs the bearer token).
export type ExportKind = 'payments' | 'receipts' | 'ledger'
export async function downloadExport(kind: ExportKind, token: string, range: { date_from?: string; date_to?: string }): Promise<void> {
  const fallback = `grid-nova-${kind}${range.date_from ? `-${range.date_from}` : ''}${range.date_to ? `-to-${range.date_to}` : ''}.csv`
  await apiDownload(`${BASE}/exports/${kind}.csv${qs(range)}`, token, fallback)
}
