import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { dashboardFetchForm } from '@/lib/associate/onboarding-api-client'
import type { PaymentOverview, RecordPaymentInput, StaffPayment } from '@/lib/associate/payment-types'

// Staff-audience payment endpoints (/api/v1/dashboard/…). Roles: admin and
// accounts everything; sales may record and read own/unassigned customers;
// management reads. Operations and engineers get 403 on every payment route —
// payment UI is hidden from them (see canSeePayments).
const BASE = '/api/v1/dashboard'

export type StaffRole = 'admin' | 'sales' | 'management' | 'engineer' | 'operations' | 'accounts'

export const canSeePayments = (role: StaffRole | undefined): boolean =>
  role === 'admin' || role === 'accounts' || role === 'sales' || role === 'management'
export const canRecordPayments = (role: StaffRole | undefined): boolean => role === 'admin' || role === 'accounts' || role === 'sales'

export interface PaymentProject {
  onboarding_id: number | null
  project_id?: number | null
  customer_name: string
  customer_email: string | null
  project_reference_id: string | null
  current_stage: string | null
  accepted_total: string
  paid_verified: string
  awaiting_verification: string
  balance: string
}

export type StaffPaymentOverview = PaymentOverview<StaffPayment> & { project: PaymentProject }

export function useStaffOnboardingPayments(onboardingId: number, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-payments', onboardingId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<StaffPaymentOverview>(`${BASE}/onboardings/${onboardingId}/payments`, token)
    },
    enabled: enabled && !!onboardingId,
  })
}

// 201 returns the staff payment itself (not the overview).
export function useRecordStaffPayment(onboardingId: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<StaffPayment>(`${BASE}/onboardings/${onboardingId}/payments`, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-payments', onboardingId] })
      void qc.invalidateQueries({ queryKey: ['staff-payments-list'] })
      void qc.invalidateQueries({ queryKey: ['work-queues'] })
    },
  })
}

export function useUploadStaffPaymentProof(onboardingId?: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, file, onProgress }: { paymentId: number; file: File; onProgress?: (percent: number) => void }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const form = new FormData()
      form.set('file', file)
      return dashboardFetchForm<StaffPayment>(`${BASE}/payments/${paymentId}/proof`, token, form, onProgress)
    },
    onSuccess: () => {
      if (onboardingId) void qc.invalidateQueries({ queryKey: ['staff-payments', onboardingId] })
      void qc.invalidateQueries({ queryKey: ['staff-payments-list'] })
    },
  })
}
