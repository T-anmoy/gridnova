// Typed hooks for staff_contracts.md §1: schedule-meeting, customer memory,
// ask memory and reflect. Base path /api/v1/dashboard.
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch as dashboardFetch, buildQS, getTokenOrThrow } from '@/lib/api/http'
import type {
  CustomerMemoryResponse, MemoryAskRequest, MemoryAskResponse, ReflectResponse,
  ScheduleMeetingRequest, ScheduleMeetingResponse,
} from '@/lib/dashboard/staff-leads-types'

const BASE = '/api/v1/dashboard'

export function useScheduleMeeting() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, body }: { leadId: number; body: ScheduleMeetingRequest }) => {
      const token = await getTokenOrThrow(getToken)
      return dashboardFetch<ScheduleMeetingResponse>(`${BASE}/leads/${leadId}/schedule-meeting`, token, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ['lead', vars.leadId] })
      void qc.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

export interface CustomerMemoryParams {
  kind?: string
  limit?: number
}

export function useCustomerMemory(customerId: number | undefined, params: CustomerMemoryParams, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['customer-memory', customerId, params.kind ?? '', params.limit ?? null],
    queryFn: async ({ signal }) => {
      const token = await getTokenOrThrow(getToken)
      const qs = buildQS({ kind: params.kind, limit: params.limit })
      return dashboardFetch<CustomerMemoryResponse>(`${BASE}/customers/${customerId}/memory${qs}`, token, { signal })
    },
    enabled: enabled && customerId != null,
  })
}

export function useAskMemory() {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async (body: MemoryAskRequest) => {
      const token = await getTokenOrThrow(getToken)
      return dashboardFetch<MemoryAskResponse>(`${BASE}/memory/ask`, token, { method: 'POST', body: JSON.stringify(body) })
    },
  })
}

export function useReflectLead() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: number) => {
      const token = await getTokenOrThrow(getToken)
      return dashboardFetch<ReflectResponse>(`${BASE}/leads/${leadId}/reflect`, token, { method: 'POST' })
    },
    onSuccess: (res) => {
      // A skipped run wrote nothing, so there is nothing to refresh.
      if (res.skipped === null) void qc.invalidateQueries({ queryKey: ['customer-memory'] })
    },
  })
}
