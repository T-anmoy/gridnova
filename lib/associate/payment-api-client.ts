import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { dashboardFetchForm } from './onboarding-api-client'
import type { FileLinkResponse } from './onboarding-types'
import type { Payment, PaymentInstructions, PaymentOverview, RecordPaymentInput, RecordPaymentResponse } from './payment-types'

// Associate-audience payment endpoints. OWNER ONLY: a Preferred Associate gets
// 403 on a downline customer's payments, so callers must only request these for
// customers the viewer owns.
const ONBOARDINGS = '/api/v1/associate/onboardings'

export function usePaymentInstructions() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['payment-instructions'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<PaymentInstructions>('/api/v1/associate/payments/instructions', token)
    },
    staleTime: 5 * 60_000,
  })
}

export function useCustomerPayments(onboardingId: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['payments', onboardingId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<PaymentOverview>(`${ONBOARDINGS}/${onboardingId}/payments`, token)
    },
    enabled: !!onboardingId,
  })
}

export function useRecordCustomerPayment(onboardingId: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<RecordPaymentResponse>(`${ONBOARDINGS}/${onboardingId}/payments`, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: ({ payment, ...overview }) => {
      qc.setQueryData(['payments', onboardingId], overview)
      void qc.invalidateQueries({ queryKey: ['home'] })
      return payment
    },
  })
}

export function useUploadPaymentProof(onboardingId: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, file, onProgress }: { paymentId: number; file: File; onProgress?: (percent: number) => void }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const form = new FormData()
      form.set('file', file)
      return dashboardFetchForm<Payment>(`${ONBOARDINGS}/${onboardingId}/payments/${paymentId}/proof`, token, form, onProgress)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payments', onboardingId] }),
  })
}

export function useCancelCustomerPayment(onboardingId: number) {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: number; reason: string }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Payment>(`${ONBOARDINGS}/${onboardingId}/payments/${paymentId}/cancel`, token, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payments', onboardingId] }),
  })
}

// Signed links are fetched on click and never cached.
export async function fetchPaymentProofLink(onboardingId: number, paymentId: number, token: string): Promise<FileLinkResponse> {
  return dashboardFetch(`${ONBOARDINGS}/${onboardingId}/payments/${paymentId}/proof`, token)
}
