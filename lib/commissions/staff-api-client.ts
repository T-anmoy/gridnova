import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDownload, apiFetch, buildQS, notAuthenticatedError } from '@/lib/api/http'
import {
  approveResultSchema,
  associatePerformanceSchema,
  associateRateSchema,
  setAssociateRateResultSchema,
  commissionQuerySchema,
  networkSummarySchema,
  payoutBatchListSchema,
  payoutBatchSchema,
  rateScheduleSchema,
  rateSchedulesSchema,
  reRateSchema,
  reverseResultSchema,
  staffCommissionsSchema,
  staffQueriesSchema,
  type AssociatePerformance,
  type AssociateRate,
  type CommissionEntry,
  type CommissionQuery,
  type NetworkSummary,
  type PayoutBatch,
  type RateSchedule,
  type RateSchedules,
  type StaffCommissions,
} from './schemas'

// Staff-audience commission endpoints (BE-4). Management reads; Accounts and Admin act;
// publishing a rate schedule, re-rating and reversing an entry are Admin only.
const BASE = '/api/v1/dashboard'

function useToken() {
  const { getToken } = useAuth()
  return async () => {
    const token = await getToken()
    if (!token) throw notAuthenticatedError()
    return token
  }
}

export interface StaffCommissionParams {
  associate_id?: string
  status?: string
  kind?: string
  earning_role?: string
  pending?: boolean
  onboarding_id?: number
  payment_id?: number
  batch_id?: number
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

const postInit = (body?: unknown): RequestInit => ({ method: 'POST', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })

export function useStaffCommissions(params: StaffCommissionParams) {
  const token = useToken()
  return useQuery({
    queryKey: ['staff-commissions', params],
    queryFn: async ({ signal }) =>
      apiFetch<StaffCommissions>(`${BASE}/commissions${buildQS({ ...params })}`, await token(), { signal }, staffCommissionsSchema),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })
}

/** Invalidates everything that shows commission money after a staff action. */
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['staff-commissions', 'payout-batches', 'payout-batch', 'rate-schedules', 'staff-commission-queries', 'network-summary'])
      void qc.invalidateQueries({ queryKey: [key] })
  }
}

export function useApproveCommissions() {
  const token = useToken()
  const done = useInvalidateAll()
  return useMutation({
    mutationFn: async (entryIds: number[]) => {
      return apiFetch<{ approved: number; items: CommissionEntry[] }>(`${BASE}/commissions/approve`, await token(), postInit({ entry_ids: entryIds }), approveResultSchema)
    },
    onSuccess: done,
  })
}

export function useReverseCommission() {
  const token = useToken()
  const done = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: number; reason: string }) => {
      return apiFetch<{ entry: CommissionEntry }>(`${BASE}/commissions/${entryId}/reverse`, await token(), postInit({ reason }), reverseResultSchema)
    },
    onSuccess: done,
  })
}

// ── Rate schedules ─────────────────────────────────────────────────────────

export function useRateSchedules() {
  const token = useToken()
  return useQuery({
    queryKey: ['rate-schedules'],
    queryFn: async ({ signal }) => apiFetch<RateSchedules>(`${BASE}/commission-rate-schedules`, await token(), { signal }, rateSchedulesSchema),
    staleTime: 20_000,
  })
}

export interface PublishScheduleInput {
  effective_from: string
  is_placeholder: boolean
  rates: Record<string, string>
  note?: string
}

export function usePublishRateSchedule() {
  const token = useToken()
  const done = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: PublishScheduleInput) => {
      return apiFetch<RateSchedule>(`${BASE}/commission-rate-schedules`, await token(), postInit(input), rateScheduleSchema)
    },
    onSuccess: done,
  })
}

export function useReRate() {
  const token = useToken()
  const done = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ scheduleId, reason }: { scheduleId: number; reason: string }) => {
      return apiFetch<{ schedule_id: number; rated: number; total_amount: string; still_pending: number }>(`${BASE}/commission-rate-schedules/${scheduleId}/re-rate`, await token(), postInit({ reason }), reRateSchema)
    },
    onSuccess: done,
  })
}

// ── Payout batches ─────────────────────────────────────────────────────────

export function usePayoutBatches(status?: string) {
  const token = useToken()
  return useQuery({
    queryKey: ['payout-batches', status ?? ''],
    queryFn: async ({ signal }) =>
      apiFetch<{ items: PayoutBatch[] }>(`${BASE}/payout-batches${buildQS({ status })}`, await token(), { signal }, payoutBatchListSchema),
    staleTime: 20_000,
  })
}

export function usePayoutBatch(batchId: number) {
  const token = useToken()
  return useQuery({
    queryKey: ['payout-batch', batchId],
    queryFn: async ({ signal }) => apiFetch<PayoutBatch>(`${BASE}/payout-batches/${batchId}`, await token(), { signal }, payoutBatchSchema),
    enabled: !!batchId,
  })
}

export function useCreatePayoutBatch() {
  const token = useToken()
  const done = useInvalidateAll()
  return useMutation({
    mutationFn: async (period: string) => {
      return apiFetch<PayoutBatch>(`${BASE}/payout-batches`, await token(), postInit({ period }), payoutBatchSchema)
    },
    onSuccess: done,
  })
}

function useBatchAction<TInput extends { batchId: number }>(action: string, body: (input: TInput) => unknown) {
  const token = useToken()
  const done = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: TInput) => {
      return apiFetch<PayoutBatch>(`${BASE}/payout-batches/${input.batchId}/${action}`, await token(), postInit(body(input)), payoutBatchSchema)
    },
    onSuccess: done,
  })
}

// The body is optional; an Admin approving a batch they prepared themselves must give a reason.
export const useApprovePayoutBatch = () =>
  useBatchAction<{ batchId: number; reason?: string }>('approve', ({ reason }) => (reason ? { reason } : {}))
export const useMarkPayoutPaid = () =>
  useBatchAction<{ batchId: number; lines: { associate_id: string; bank_reference: string }[] }>('mark-paid', ({ lines }) => ({ lines }))
export const useCancelPayoutBatch = () => useBatchAction<{ batchId: number; reason: string }>('cancel', ({ reason }) => ({ reason }))

// ── Commission queries ─────────────────────────────────────────────────────

export function useStaffCommissionQueries(params: { status?: string; overdue?: boolean; page?: number; page_size?: number }) {
  const token = useToken()
  return useQuery({
    queryKey: ['staff-commission-queries', params],
    queryFn: async ({ signal }) =>
      apiFetch<{ items: CommissionQuery[]; page: number; page_size: number; total: number }>(
        `${BASE}/commission-queries${buildQS({ ...params, overdue: params.overdue ? true : undefined })}`,
        await token(),
        { signal },
        staffQueriesSchema,
      ),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })
}

export function useRespondToQuery() {
  const token = useToken()
  const done = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ queryId, response }: { queryId: number; response: string }) => {
      return apiFetch<CommissionQuery>(`${BASE}/commission-queries/${queryId}/respond`, await token(), postInit({ response }), commissionQuerySchema)
    },
    onSuccess: done,
  })
}

// ── Exports (authenticated blob download; never a bare link) ───────────────

export type CommissionExport =
  | { kind: 'commissions'; date_from?: string; date_to?: string }
  | { kind: 'tds'; financial_year?: string }
  | { kind: 'bank'; batchId: number }

export function useCommissionExport() {
  const token = useToken()
  return async (x: CommissionExport) => {
    const t = await token()
    if (x.kind === 'commissions')
      return apiDownload(`${BASE}/exports/commissions.csv${buildQS({ date_from: x.date_from, date_to: x.date_to })}`, t, 'grid-nova-commissions.csv')
    if (x.kind === 'tds')
      return apiDownload(`${BASE}/exports/tds.csv${buildQS({ financial_year: x.financial_year })}`, t, `grid-nova-tds${x.financial_year ? `-${x.financial_year}` : ''}.csv`)
    return apiDownload(`${BASE}/exports/payout-bank-${x.batchId}.csv`, t, `grid-nova-payout-bank-${x.batchId}.csv`)
  }
}

// ── Network Command Centre ─────────────────────────────────────────────────

export function useNetworkSummary(params: { date_from?: string; date_to?: string }) {
  const token = useToken()
  return useQuery({
    queryKey: ['network-summary', params],
    queryFn: async ({ signal }) =>
      apiFetch<NetworkSummary>(`${BASE}/network/summary${buildQS({ ...params })}`, await token(), { signal }, networkSummarySchema),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

// ── Individual rate and performance (BE-12) ────────────────────────────────
// Admin and Management read; only Admin sets. The server decides, so a 403 is shown as such.

export function useAssociateRate(associateId: string) {
  const token = useToken()
  return useQuery({
    queryKey: ['associate-rate', associateId],
    queryFn: async ({ signal }) =>
      apiFetch<AssociateRate>(`${BASE}/associates/${encodeURIComponent(associateId)}/commission-rate`, await token(), { signal }, associateRateSchema),
    enabled: !!associateId,
    staleTime: 20_000,
    retry: false,
  })
}

export interface SetAssociateRateInput {
  /** A percentage string, or null = back to the standard schedule. A JSON number is refused by the server. */
  rate_percent: string | null
  effective_from: string
  reason: string
}

export function useSetAssociateRate(associateId: string) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SetAssociateRateInput) =>
      apiFetch<{ change: unknown; rate: AssociateRate }>(
        `${BASE}/associates/${encodeURIComponent(associateId)}/commission-rate`,
        await token(),
        postInit(input),
        setAssociateRateResultSchema,
      ),
    onSuccess: ({ rate }) => {
      qc.setQueryData(['associate-rate', associateId], rate)
      void qc.invalidateQueries({ queryKey: ['associate-performance', associateId] })
      void qc.invalidateQueries({ queryKey: ['staff-commissions'] })
    },
  })
}

export function useAssociatePerformance(associateId: string, range: { date_from?: string; date_to?: string }) {
  const token = useToken()
  return useQuery({
    queryKey: ['associate-performance', associateId, range],
    queryFn: async ({ signal }) =>
      apiFetch<AssociatePerformance>(`${BASE}/associates/${encodeURIComponent(associateId)}/performance${buildQS({ ...range })}`, await token(), { signal }, associatePerformanceSchema),
    enabled: !!associateId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  })
}
