import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiDownload, apiFetch as dashboardFetch, buildQS } from '@/lib/api/http'
import {
  overviewStatsSchema,
  activityFeedResponseSchema,
  conversionBySourceResponseSchema,
  dealSizeByTierResponseSchema,
  repPerformanceResponseSchema,
  pipelineTrendResponseSchema,
  leadListResponseSchema,
  proposalListResponseSchema,
  meetingListResponseSchema,
} from './schemas'
import type {
  ActivityItem,
  AdjustPricingResponse,
  AgentAuditResponse,
  AssignableEmployee,
  AgentId,
  AnalyticsParams,
  AnalyticsResponse,
  AuditLog,
  AuditLogParams,
  ConversionBySource,
  CreateLeadInput,
  CreateLeadResponse,
  DealSizeByTier,
  DraftProposalResponse,
  Employee,
  EmployeeMe,
  Equipment,
  EquipmentCreateInput,
  EquipmentListParams,
  GovernanceAgentsResponse,
  LeadDetail,
  LeadListParams,
  LeadReassignResponse,
  LeadStageChangeResponse,
  LeadSummary,
  MeetingListParams,
  MeetingSummary,
  OverviewStats,
  PaginatedResponse,
  PipelineStage,
  PipelineTrendPoint,
  ProposalDetail,
  ProposalInputDetail,
  ProposalInputFileUrlResponse,
  ProposalInputSummary,
  ProposalListParams,
  ProposalPdfResponse,
  ProposalStatus,
  ProposalSummary,
  RepPerformance,
  ReviewProposalInputResponse,
  Role,
  SendProposalResponse,
  UpdateLeadFieldsResponse,
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

// List views change slowly relative to how often staff navigate between them;
// a 60s stale window means bouncing Leads ↔ Proposals ↔ Overview doesn't
// refetch every time, while still staying fresh within a working session.
const LIST_STALE_TIME = 60_000

// Re-exported so existing imports keep working; the implementation lives in
// lib/api/http.ts (the single transport layer).
export { apiFetch as dashboardFetch, buildQS } from '@/lib/api/http'

// ── Hooks ──────────────────────────────────────────────────────────────────────

export const LEADS_PAGE_SIZE = 25

/** The list query a role lands on with no filters set — shared by the page and the sidebar prefetch so the cache keys match. */
export function defaultLeadListParams(role: Role | undefined): LeadListParams {
  return { page: 1, page_size: LEADS_PAGE_SIZE, ...(role === 'sales' ? { assigned: 'any' as const } : {}) }
}

export function useLeads(params?: LeadListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async ({ signal }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch(`/api/v1/dashboard/leads${qs}`, token, { signal }, leadListResponseSchema) as Promise<PaginatedResponse<LeadSummary>>
    },
    staleTime: LIST_STALE_TIME,
    // Keep the old page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

// Prefetch helpers — used to warm list caches on sidebar link hover so the
// destination renders from cache instantly. The key must equal the one the
// page builds for the same (unfiltered) view, hence the shared params.
export function prefetchLeads(qc: QueryClient, getToken: () => Promise<string | null>, params?: LeadListParams) {
  return qc.prefetchQuery({
    queryKey: ['leads', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch('/api/v1/dashboard/leads' + qs, token, undefined, leadListResponseSchema) as Promise<PaginatedResponse<LeadSummary>>
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<LeadDetail>(`/api/v1/dashboard/leads/${id}`, token)
    },
    enabled: !!id,
  })
}

export function useChangeLeadStage() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, stage, reason }: { leadId: number; stage: PipelineStage; reason?: string | null }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<LeadStageChangeResponse>(
        `/api/v1/dashboard/leads/${leadId}/stage`,
        token,
        { method: 'PATCH', body: JSON.stringify({ stage, reason: reason ?? null }) }
      )
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['lead', vars.leadId] })
      void qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useReassignLead() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, employeeId }: { leadId: number; employeeId: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<LeadReassignResponse>(
        `/api/v1/dashboard/leads/${leadId}/assign`,
        token,
        { method: 'PATCH', body: JSON.stringify({ employee_id: employeeId }) }
      )
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['lead', vars.leadId] })
      void qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useCreateLead() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<CreateLeadResponse>(
        '/api/v1/dashboard/leads',
        token,
        { method: 'POST', body: JSON.stringify(input) }
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useUpdateLeadFields() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, fields }: { leadId: number; fields: Record<string, unknown> }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<UpdateLeadFieldsResponse>(
        `/api/v1/dashboard/leads/${leadId}/fields`,
        token,
        { method: 'PATCH', body: JSON.stringify(fields) }
      )
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['lead', vars.leadId] })
      void qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useProposals(params?: ProposalListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['proposals', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ProposalPdfResponse>(`/api/v1/dashboard/proposals/${id}/pdf`, token)
    },
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      // Stop polling once the PDF is ready, or on a terminal error (409
      // pdf_location_unknown / 503 storage_not_configured) — neither
      // resolves itself by retrying every 5s.
      if (query.state.error) return false
      const data = query.state.data
      if (data && 'pdf_url' in data && data.pdf_url) return false
      return 5000
    },
    retry: false,
  })
}

// On-demand signed PDF link for an already-sent proposal — fetched fresh on
// click (never on page load, never cached), since the link is short-lived.
export async function fetchProposalPdf(id: number, token: string): Promise<ProposalPdfResponse> {
  return dashboardFetch(`/api/v1/dashboard/proposals/${id}/pdf`, token)
}

export function useAnalytics(params?: AnalyticsParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      // Backend wraps the list in an envelope ({ weeks: [...] }), not a bare array.
      const res = await dashboardFetch(`/api/v1/dashboard/analytics/pipeline-trend${qs}`, token, undefined, pipelineTrendResponseSchema)
      return res.weeks as PipelineTrendPoint[]
    },
  })
}

export function useEmployees(options?: { enabled?: boolean }) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<Employee[]>('/api/v1/dashboard/employees', token)
    },
    enabled: options?.enabled ?? true,
  })
}

// GET /employees/assignable (admin + management) — the reassign picker's
// real data source. Unlike GET /employees, this is not admin-only.
export function useAssignableEmployees(options?: { enabled?: boolean }) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['employees-assignable'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<AssignableEmployee[]>('/api/v1/dashboard/employees/assignable', token)
    },
    enabled: options?.enabled ?? true,
  })
}

// The signed-in employee's own record — role comes from the login token
// (the source of truth for permission checks), plus calendar-connect status.
export function useEmployeeMe() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['employee-me'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<EmployeeMe>('/api/v1/dashboard/employees/me', token)
    },
  })
}

export function useConnectCalendar() {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<{ authorization_url: string }>(
        '/api/v1/dashboard/employees/me/calendar/connect',
        token
      )
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedResponse<AuditLog>>(`/api/v1/dashboard/audit-log${qs}`, token)
    },
  })
}

// ── Site assessments (proposal-inputs) ───────────────────────────────────────

export function useProposalInputs(params?: { status?: string; page?: number; page_size?: number }) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['proposal-inputs', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<{ items: ProposalInputSummary[]; page: number; page_size: number; total: number }>(
        `/api/v1/proposal-inputs/${qs}`,
        token
      )
    },
    staleTime: LIST_STALE_TIME,
  })
}

export function useProposalInput(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['proposal-input', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ProposalInputDetail>(`/api/v1/proposal-inputs/${id}`, token)
    },
    enabled: !!id,
  })
}

export function useReviewProposalInput() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      inputId,
      status,
      internalNotes,
      rejectionReason,
    }: {
      inputId: number
      status: 'under_review' | 'approved_for_proposal' | 'rejected'
      internalNotes?: string
      rejectionReason?: string
    }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ReviewProposalInputResponse>(
        `/api/v1/proposal-inputs/${inputId}/review`,
        token,
        // rejection_reason is the real field name — a field named `reason`
        // is silently ignored by the backend.
        { method: 'PATCH', body: JSON.stringify({ status, internal_notes: internalNotes, rejection_reason: rejectionReason }) }
      )
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['proposal-input', vars.inputId] })
      void qc.invalidateQueries({ queryKey: ['proposal-inputs'] })
    },
  })
}

// Signed download URLs expire — this is a plain fetch (not a cached query) so
// every click gets a fresh one, never a stale cached link.
export async function fetchProposalInputFileUrl(
  inputId: number,
  fileRef: string,
  token: string
): Promise<ProposalInputFileUrlResponse> {
  return dashboardFetch(`/api/v1/proposal-inputs/${inputId}/files/${fileRef}`, token)
}

export function useMeetings(params?: MeetingListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['meetings', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch(`/api/v1/dashboard/meetings${qs}`, token, undefined, meetingListResponseSchema) as unknown as Promise<PaginatedResponse<MeetingSummary>>
    },
  })
}

export function useOverviewStats() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['overview-stats'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch('/api/v1/dashboard/overview-stats', token, undefined, overviewStatsSchema) as Promise<OverviewStats>
    },
    staleTime: 30_000,
  })
}

export function useActivityFeed() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn: async ({ signal }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      // Backend wraps the list in an envelope ({ items: [...] }), not a bare array.
      const res = await dashboardFetch('/api/v1/dashboard/activity/recent', token, { signal }, activityFeedResponseSchema)
      return res.items as ActivityItem[]
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useLeadSearch(query: string) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['lead-search', query],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      // `q` is the backend's search parameter (BE-1 §2); the response is the paged envelope.
      const qs = buildQS({ q: query, page_size: 5 })
      const res = await dashboardFetch(`/api/v1/dashboard/leads${qs}`, token, undefined, leadListResponseSchema)
      return res.items as LeadSummary[]
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
      if (!token) throw notAuthenticatedError()
      const qs = buildQS({ search: query, page_size: 5 })
      return dashboardFetch<PaginatedResponse<ProposalSummary>>(`/api/v1/dashboard/proposals${qs}`, token)
    },
    enabled: query.length > 1,
    staleTime: 15_000,
  })
}

export async function downloadLeadsCsv(params: LeadListParams, token: string): Promise<void> {
  const qs = buildQS(params as Record<string, string | number | boolean | undefined | null>)
  await apiDownload(`/api/v1/dashboard/leads/export${qs}`, token, 'leads.csv')
}

export async function downloadProposalsCsv(params: ProposalListParams, token: string): Promise<void> {
  const qs = buildQS(params as Record<string, string | number | boolean | undefined | null>)
  await apiDownload(`/api/v1/dashboard/proposals/export${qs}`, token, 'proposals.csv')
}

// ── Mutation hooks ─────────────────────────────────────────────────────────────

export function useApproveProposal() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (proposalId: number) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SendProposalResponse>(
        `/api/v1/dashboard/proposals/${proposalId}/send`,
        token,
        { method: 'POST' }
      )
    },
    ...optimisticProposalUpdate<number>(qc, (id) => id, 'sent'),
  })
}

export function useAdjustPricing() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ proposalId, newValue, reason }: { proposalId: number; newValue: number; reason: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<AdjustPricingResponse>(
        `/api/v1/dashboard/proposals/${proposalId}/adjust-pricing`,
        token,
        { method: 'PATCH', body: JSON.stringify({ new_value: newValue, reason }) }
      )
    },
    // The pricing section content is rewritten server-side — a full refetch
    // (not an optimistic patch) is the only honest way to show the real
    // updated content, per the contract note on this endpoint.
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['proposal', vars.proposalId] })
      void qc.invalidateQueries({ queryKey: ['proposals'] })
    },
  })
}

export function useDraftProposal() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lead_id, customer_id }: { lead_id: number; customer_id: number }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
