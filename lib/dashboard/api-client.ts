import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { ApiError, ApiShapeError } from './api-error'
import {
  formatZodError,
  overviewStatsSchema,
  activityFeedResponseSchema,
  conversionBySourceResponseSchema,
  dealSizeByTierResponseSchema,
  repPerformanceResponseSchema,
  pipelineTrendResponseSchema,
  leadListResponseSchema,
  proposalListResponseSchema,
} from './schemas'
import type {
  ActivityItem,
  AgentAuditResponse,
  AgentId,
  AnalyticsParams,
  AnalyticsResponse,
  AuditLog,
  AuditLogParams,
  ConversionBySource,
  DealSizeByTier,
  DraftProposalResponse,
  Employee,
  Equipment,
  EquipmentCreateInput,
  EquipmentListParams,
  GovernanceAgentsResponse,
  LeadDetail,
  LeadListParams,
  LeadSummary,
  OverviewStats,
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

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// List views change slowly relative to how often staff navigate between them;
// a 60s stale window means bouncing Leads ↔ Proposals ↔ Overview doesn't
// refetch every time, while still staying fresh within a working session.
const LIST_STALE_TIME = 60_000

export async function dashboardFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
  // Optional runtime shape check. When provided, a 2xx response that doesn't
  // match throws ApiShapeError identifying exactly which field didn't match,
  // instead of returning data the caller's type wrongly promises is safe.
  schema?: z.ZodType<T>
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
  const data: unknown = await res.json()
  if (!schema) return data as T
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new ApiShapeError(path, formatZodError(parsed.error))
  }
  return parsed.data
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
      return dashboardFetch(`/api/v1/dashboard/leads${qs}`, token, undefined, leadListResponseSchema) as Promise<LeadSummary[]>
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
      return dashboardFetch(`/api/v1/dashboard/proposals${qs}`, token, undefined, proposalListResponseSchema) as unknown as Promise<PaginatedResponse<ProposalSummary>>
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
      // Backend wraps the list in an envelope ({ by_source: [...] }), not a bare array.
      const res = await dashboardFetch(`/api/v1/dashboard/analytics/conversion-by-source${qs}`, token, undefined, conversionBySourceResponseSchema)
      return res.by_source as ConversionBySource[]
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
      // Backend wraps the list in an envelope ({ by_tier: [...] }), not a bare array.
      const res = await dashboardFetch(`/api/v1/dashboard/analytics/deal-size-by-tier${qs}`, token, undefined, dealSizeByTierResponseSchema)
      return res.by_tier as DealSizeByTier[]
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
      // Backend wraps the list in an envelope ({ reps: [...] }), not a bare array.
      const res = await dashboardFetch(`/api/v1/dashboard/analytics/rep-performance${qs}`, token, undefined, repPerformanceResponseSchema)
      return res.reps as RepPerformance[]
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
      // Backend wraps the list in an envelope ({ weeks: [...] }), not a bare array.
      const res = await dashboardFetch(`/api/v1/dashboard/analytics/pipeline-trend${qs}`, token, undefined, pipelineTrendResponseSchema)
      return res.weeks as PipelineTrendPoint[]
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

// ── Agent governance hooks (admin only) ──────────────────────────────────────

export function useGovernanceAgents() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['governance-agents'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<GovernanceAgentsResponse>('/api/v1/governance/agents', token)
    },
  })
}

export function useAgentAudit(agentId: AgentId) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['agent-audit', agentId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<AgentAuditResponse>(`/api/v1/governance/agents/${agentId}/audit`, token)
    },
  })
}

// ── Equipment / SKU master hooks (read: any employee; write: admin only) ────

export function useEquipment(params?: EquipmentListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['equipment', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      const res = await dashboardFetch<{ items: Equipment[] }>(`/api/v1/equipment/${qs}`, token)
      return res.items
    },
  })
}

export function useCreateEquipment() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EquipmentCreateInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Equipment>('/api/v1/equipment/', token, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['equipment'] })
    },
  })
}

export function useSetEquipmentActive() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Equipment>(`/api/v1/equipment/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['equipment'] })
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

export function useOverviewStats() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['overview-stats'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch('/api/v1/dashboard/overview-stats', token, undefined, overviewStatsSchema) as Promise<OverviewStats>
    },
    staleTime: 30_000,
  })
}

export function useActivityFeed() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      // Backend wraps the list in an envelope ({ items: [...] }), not a bare array.
      const res = await dashboardFetch('/api/v1/dashboard/activity/recent', token, undefined, activityFeedResponseSchema)
      return res.items as ActivityItem[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useLeadSearch(query: string) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['lead-search', query],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS({ search: query, page_size: 5 })
      return dashboardFetch<LeadSummary[]>(`/api/v1/dashboard/leads${qs}`, token)
    },
    enabled: query.length > 1,
    staleTime: 15_000,
  })
}

export function useProposalSearch(query: string) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['proposal-search', query],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS({ search: query, page_size: 5 })
      return dashboardFetch<PaginatedResponse<ProposalSummary>>(`/api/v1/dashboard/proposals${qs}`, token)
    },
    enabled: query.length > 1,
    staleTime: 15_000,
  })
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadLeadsCsv(params: LeadListParams, token: string): Promise<void> {
  const qs = buildQS(params as Record<string, string | number | boolean | undefined | null>)
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/api/v1/dashboard/leads/export${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError(0, 'Network request failed')
  }
  if (!res.ok) throw new ApiError(res.status, `Export failed ${res.status}`)
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="?([^";\n]+)"?/i)?.[1]?.trim() ?? 'leads.csv'
  triggerDownload(blob, filename)
}

export async function downloadProposalsCsv(params: ProposalListParams, token: string): Promise<void> {
  const qs = buildQS(params as Record<string, string | number | boolean | undefined | null>)
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/api/v1/dashboard/proposals/export${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError(0, 'Network request failed')
  }
  if (!res.ok) throw new ApiError(res.status, `Export failed ${res.status}`)
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="?([^";\n]+)"?/i)?.[1]?.trim() ?? 'proposals.csv'
  triggerDownload(blob, filename)
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

export function useDeactivateEmployee() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ employee_id: string; is_active: boolean }>(
        `/api/v1/dashboard/employees/${employeeId}/deactivate`,
        token,
        { method: 'PATCH' }
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useReactivateEmployee() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ employee_id: string; is_active: boolean }>(
        `/api/v1/dashboard/employees/${employeeId}/reactivate`,
        token,
        { method: 'PATCH' }
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useToggleAgent() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ agentId, enabled }: { agentId: AgentId; enabled: boolean }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<{ agent_id: string; enabled: boolean; updated_by: string }>(
        `/api/v1/governance/agents/${agentId}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ enabled }) }
      )
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['governance-agents'] })
      void qc.invalidateQueries({ queryKey: ['agent-audit', variables.agentId] })
    },
  })
}
