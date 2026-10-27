import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import type { PermissionRule } from '@/lib/access/permissions'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { dashboardFetchForm } from '@/lib/associate/onboarding-api-client'
import type { PaymentOverview, RecordPaymentInput, StaffPayment } from '@/lib/associate/payment-types'

// Staff-audience payment endpoints (/api/v1/dashboard/…). payments.process does
// everything; payments.record records and (with payments.view) reads own/unassigned
// customers; payments.view_all reads every customer. Operations and engineers get 403 on every payment route —
// payment UI is hidden from them (see canSeePayments).
const BASE = '/api/v1/dashboard'

type Can = (rule: PermissionRule) => boolean

// `can` is usePermissions().can (GET /employees/me).
export const canSeePayments = (can: Can): boolean => can('payments.view')
export const canRecordPayments = (can: Can): boolean => can('payments.record')

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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
