import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ApiError } from './api-error'
import type {
  AnalyticsParams,
  AnalyticsResponse,
  AuditLog,
  AuditLogParams,
  ConversionBySource,
  DealSizeByTier,
  DraftProposalResponse,
  Employee,
  LeadDetail,
  LeadListParams,
  LeadSummary,
  PaginatedResponse,
  PipelineTrendPoint,
  ProposalDetail,
  ProposalListParams,
  ProposalStatus,
  ProposalSummary,
  RepPerformance,
  Role,
} from './types'

interface OptimisticCtx {
  previous?: ProposalDetail
  proposalId: number
}

// Build shared optimistic-update handlers for a proposal status mutation:
// snapshot + apply the expected next status immediately, roll back on error,
// and reconcile with the server on settle. `getId` reads the proposal id from
// whatever variables the mutation is called with.
function optimisticProposalUpdate<V>(
  qc: QueryClient,
  getId: (vars: V) => number,
  nextStatus: ProposalStatus | ((current: ProposalStatus | undefined) => ProposalStatus | undefined),
) {
  return {
    onMutate: async (vars: V): Promise<OptimisticCtx> => {
      const proposalId = getId(vars)
      await qc.cancelQueries({ queryKey: ['proposal', proposalId] })
      const previous = qc.getQueryData<ProposalDetail>(['proposal', proposalId])
      const next = typeof nextStatus === 'function' ? nextStatus(previous?.status) : nextStatus
      if (previous && next) {
        qc.setQueryData<ProposalDetail>(['proposal', proposalId], { ...previous, status: next })
      }
      return { previous, proposalId }
    },
    onError: (_err: unknown, _vars: V, ctx: OptimisticCtx | undefined) => {
      if (ctx?.previous) qc.setQueryData(['proposal', ctx.proposalId], ctx.previous)
    },
    onSettled: (_data: unknown, _err: unknown, _vars: V, ctx: OptimisticCtx | undefined) => {
      if (ctx?.proposalId) void qc.invalidateQueries({ queryKey: ['proposal', ctx.proposalId] })
      void qc.invalidateQueries({ queryKey: ['proposals'] })
    },
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

// List views change slowly relative to how often staff navigate between them;
// a 60s stale window means bouncing Leads ↔ Proposals ↔ Overview doesn't
// refetch every time, while still staying fresh within a working session.
const LIST_STALE_TIME = 60_000

export async function dashboardFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    })
  } catch {
    // True network failure (server unreachable, DNS, offline) — status 0.
    throw new ApiError(0, 'Network request failed')
  }
  if (!res.ok) {
    // Prefer a structured { detail } body (FastAPI style), else raw text.
    const body = await res.text().catch(() => '')
    let detail = body
    try {
      const parsed = JSON.parse(body) as { detail?: unknown; message?: unknown }
      const d = parsed.detail ?? parsed.message
      if (typeof d === 'string' && d) detail = d
    } catch {
      /* not JSON — keep raw text */
    }
    throw new ApiError(res.status, `API error ${res.status}`, detail || res.statusText)
  }
  return res.json() as Promise<T>
}

function buildQS(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v))
    }
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useLeads(params?: LeadListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<LeadSummary[]>(`/api/v1/dashboard/leads${qs}`, token)
    },
    staleTime: LIST_STALE_TIME,
  })
}

// Prefetch helpers — used to warm list caches on sidebar link hover so the
// destination renders from cache instantly. Keys mirror the hooks exactly.
export function prefetchLeads(qc: QueryClient, getToken: () => Promise<string | null>) {
  return qc.prefetchQuery({
    queryKey: ['leads', undefined],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<LeadSummary[]>('/api/v1/dashboard/leads', token)
    },
    staleTime: LIST_STALE_TIME,
  })
}

// Matches the Proposals page's initial (unfiltered, first-page) query key.
const DEFAULT_PROPOSALS_PARAMS: ProposalListParams = {
  status: undefined,
  date_from: undefined,
  date_to: undefined,
  page: 1,
  page_size: 50,
}

export function prefetchProposals(qc: QueryClient, getToken: () => Promise<string | null>) {
  return qc.prefetchQuery({
    queryKey: ['proposals', DEFAULT_PROPOSALS_PARAMS],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS(DEFAULT_PROPOSALS_PARAMS as Record<string, string | number | boolean | undefined | null>)
      return dashboardFetch<PaginatedResponse<ProposalSummary>>(`/api/v1/dashboard/proposals${qs}`, token)
    },
    staleTime: LIST_STALE_TIME,
  })
}

export function useLead(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<LeadDetail>(`/api/v1/dashboard/leads/${id}`, token)
    },
    enabled: !!id,
  })
}

export function useProposals(params?: ProposalListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['proposals', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedResponse<ProposalSummary>>(`/api/v1/dashboard/proposals${qs}`, token)
    },
    staleTime: LIST_STALE_TIME,
  })
}

export function useProposal(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<ProposalDetail>(`/api/v1/dashboard/proposals/${id}`, token)
    },
    enabled: !!id,
  })
}

export function useProposalPdf(id: number, enabled: boolean) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['proposal-pdf', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ pdf_url?: string; status?: string; proposal_id: number }>(
        `/api/v1/dashboard/proposals/${id}/pdf`,
        token
      )
    },
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data && 'pdf_url' in data && data.pdf_url) return false
      return 5000
    },
  })
}

export function useAnalytics(params?: AnalyticsParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<AnalyticsResponse>(`/api/v1/dashboard/analytics${qs}`, token)
    },
    staleTime: LIST_STALE_TIME,
  })
}

// ── Reporting hooks (admin/management only endpoints) ────────────────────────

export function useConversionBySource(params?: AnalyticsParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['analytics-conversion-by-source', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<ConversionBySource[]>(`/api/v1/analytics/conversion-by-source${qs}`, token)
    },
  })
}

export function useDealSizeByTier(params?: AnalyticsParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['analytics-deal-size-by-tier', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<DealSizeByTier[]>(`/api/v1/analytics/deal-size-by-tier${qs}`, token)
    },
  })
}

export function useRepPerformance(params?: AnalyticsParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['analytics-rep-performance', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<RepPerformance[]>(`/api/v1/analytics/rep-performance${qs}`, token)
    },
  })
}

export function usePipelineTrend(params?: AnalyticsParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['analytics-pipeline-trend', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PipelineTrendPoint[]>(`/api/v1/analytics/pipeline-trend${qs}`, token)
    },
  })
}

export function useEmployees() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Employee[]>('/api/v1/dashboard/employees', token)
    },
  })
}

export function useAuditLog(params?: AuditLogParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['audit-log', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedResponse<AuditLog>>(`/api/v1/dashboard/audit-log${qs}`, token)
    },
  })
}

// ── Mutation hooks ─────────────────────────────────────────────────────────────

export function useApproveProposal() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (proposalId: number) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ status: string; proposal_id: number }>(
        `/api/v1/dashboard/proposals/${proposalId}/approve`,
        token,
        { method: 'POST' }
      )
    },
    // Only the unambiguous pending_approval → approved step is shown
    // optimistically; the earlier draft step reconciles on settle.
    ...optimisticProposalUpdate<number>(
      qc,
      (id) => id,
      (current) => (current === 'pending_approval' ? 'approved' : undefined),
    ),
  })
}

export function useManagerSignOff() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (proposalId: number) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ status: string; proposal_id: number; signoff_by: string }>(
        `/api/v1/dashboard/proposals/${proposalId}/manager-sign-off`,
        token,
        { method: 'POST' }
      )
    },
    ...optimisticProposalUpdate<number>(qc, (id) => id, 'approved'),
  })
}

export function useRequestRevision() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ proposalId, reason }: { proposalId: number; reason: string }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ status: string; proposal_id: number; reason: string }>(
        `/api/v1/dashboard/proposals/${proposalId}/request-revision`,
        token,
        { method: 'POST', body: JSON.stringify({ reason }) }
      )
    },
    ...optimisticProposalUpdate<{ proposalId: number; reason: string }>(
      qc,
      (v) => v.proposalId,
      'revision_requested',
    ),
  })
}

export function useSendProposal() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (proposalId: number) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ status: string; proposal_id: number }>(
        `/api/v1/dashboard/proposals/${proposalId}/send`,
        token,
        { method: 'POST' }
      )
    },
    ...optimisticProposalUpdate<number>(qc, (id) => id, 'sent'),
  })
}

export function useDraftProposal() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lead_id, customer_id }: { lead_id: number; customer_id: number }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<DraftProposalResponse>(
        '/api/v1/dashboard/proposals/draft',
        token,
        { method: 'POST', body: JSON.stringify({ lead_id, customer_id }) }
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposals'] })
      void qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useUpdateEmployeeRole() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, role }: { employeeId: string; role: Role }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ employee_id: string; role: Role; clerk_synced: boolean; local_mirror: boolean }>(
        `/api/v1/dashboard/employees/${employeeId}/role`,
        token,
        { method: 'POST', body: JSON.stringify({ role }) }
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
