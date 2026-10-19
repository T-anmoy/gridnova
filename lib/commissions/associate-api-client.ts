import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, buildQS, notAuthenticatedError } from '@/lib/api/http'
import {
  associateCommissionsSchema,
  associatePayoutsSchema,
  commissionQuerySchema,
  entryQueriesSchema,
  type AssociateCommissions,
  type AssociatePayouts,
  type CommissionQuery,
} from './schemas'

// Associate-audience commission endpoints (BE-4). An Associate sees only their own entries;
// a Preferred Associate also sees the territory entries — the server decides, never the client.
const BASE = '/api/v1/associate'

export interface MyCommissionParams {
  status?: string
  kind?: string
  page?: number
  page_size?: number
}

function useToken() {
  const { getToken } = useAuth()
  return async () => {
    const token = await getToken()
    if (!token) throw notAuthenticatedError()
    return token
  }
}

export function useMyCommissions(params: MyCommissionParams) {
  const token = useToken()
  return useQuery({
    queryKey: ['commissions', params],
    queryFn: async ({ signal }) =>
      apiFetch<AssociateCommissions>(`${BASE}/commissions${buildQS({ ...params })}`, await token(), { signal }, associateCommissionsSchema),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useMyPayouts() {
  const token = useToken()
  return useQuery({
    queryKey: ['commission-payouts'],
    queryFn: async ({ signal }) => apiFetch<AssociatePayouts>(`${BASE}/payouts`, await token(), { signal }, associatePayoutsSchema),
    staleTime: 30_000,
  })
}

export function useEntryQueries(entryId: number, enabled: boolean) {
  const token = useToken()
  return useQuery({
    queryKey: ['commission-queries', entryId],
    queryFn: async ({ signal }) =>
      apiFetch<{ items: CommissionQuery[] }>(`${BASE}/commissions/${entryId}/queries`, await token(), { signal }, entryQueriesSchema),
    enabled,
  })
}

export function useRaiseCommissionQuery() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ entryId, message }: { entryId: number; message: string }) =>
      apiFetch<CommissionQuery>(
        `${BASE}/commissions/${entryId}/queries`,
        await token(),
        { method: 'POST', body: JSON.stringify({ message }) },
        commissionQuerySchema,
      ),
    onSuccess: (_q, { entryId }) => {
      void qc.invalidateQueries({ queryKey: ['commissions'] })
      void qc.invalidateQueries({ queryKey: ['commission-queries', entryId] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
}
