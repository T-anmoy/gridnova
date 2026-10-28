import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, backoffDelay } from '@/lib/dashboard/api-error'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { publicFetch } from '@/lib/api/http'
import type {
  AssociateCustomers,
  AdminAssociate,
  AdminTerritoryItem,
  ApplicationDetail,
  ApplicationListItem,
  ApplicationListParams,
  ApplicationType,
  ApplyResponse,
  AssociateLevel,
  AssociateListParams,
  AssociateMe,
  AssociateStatus,
  AssociateStatusChange,
  KycConsent,
  PaginatedTerritoryMembers,
  ReassignCustomersInput,
  ReassignCustomersResult,
  SeatAvailability,
  SignedDocumentLink,
  TerritoryBlock,
  TerritoryDistrict,
  TerritoryMemberListParams,
  TerritorySeat,
  TerritoryState,
  VerifyAssociateResponse,
} from './types'
import type { PaginatedResponse } from '@/lib/dashboard/types'

// Shared plain fetch (no auth) for the public surface — see lib/api/http.ts.
export { publicFetch }

// ── Public reference data ────────────────────────────────────────────────────

// Territory lookups retry only transient failures (network, 5xx) — never a 4xx
// or a 503, which is the backend's "territories_not_seeded" answer and won't
// fix itself within a retry — at most twice, with backoff.
export function shouldRetryTerritoryLookup(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2 || !(error instanceof ApiError)) return false
  return error.status === 0 || (error.status >= 500 && error.status !== 503)
}

const territoryLookupOptions = {
  staleTime: 5 * 60_000,
  retry: shouldRetryTerritoryLookup,
  retryDelay: backoffDelay,
  refetchOnWindowFocus: false,
} as const

export function useTerritoryStates() {
  return useQuery({
    queryKey: ['territory-states'],
    queryFn: () => publicFetch<{ items: TerritoryState[] }>('/api/v1/public/territories/states').then((r) => r.items),
    ...territoryLookupOptions,
  })
}

export function useTerritoryDistricts(stateLgdCode: number | undefined) {
  return useQuery({
    queryKey: ['territory-districts', stateLgdCode],
    queryFn: () =>
      publicFetch<{ items: TerritoryDistrict[] }>(`/api/v1/public/territories/states/${stateLgdCode}/districts`).then(
        (r) => r.items
      ),
    enabled: !!stateLgdCode,
    ...territoryLookupOptions,
  })
}

export function useTerritoryBlocks(districtLgdCode: number | undefined) {
  return useQuery({
    queryKey: ['territory-blocks', districtLgdCode],
    queryFn: () =>
      publicFetch<{ items: TerritoryBlock[] }>(`/api/v1/public/territories/districts/${districtLgdCode}/blocks`).then(
        (r) => r.items
      ),
    enabled: !!districtLgdCode,
    ...territoryLookupOptions,
  })
}

// Fetched fresh at the consent screen so the version submitted always matches
// the text shown — never cached alongside a stale version string.
export function useKycConsent() {
  return useQuery({
    queryKey: ['kyc-consent'],
    queryFn: () => publicFetch<KycConsent>('/api/v1/public/kyc-consent'),
    staleTime: 60_000,
  })
}

export function useSeatAvailability(params: {
  level: AssociateLevel
  state_lgd_code?: number
  district_lgd_code?: number
  block_lgd_code?: number
} | null) {
  return useQuery({
    queryKey: ['seat-availability', params],
    queryFn: () => {
      const qs = new URLSearchParams()
      qs.set('level', params!.level)
      if (params!.state_lgd_code) qs.set('state_lgd_code', String(params!.state_lgd_code))
      if (params!.district_lgd_code) qs.set('district_lgd_code', String(params!.district_lgd_code))
      if (params!.block_lgd_code) qs.set('block_lgd_code', String(params!.block_lgd_code))
      return publicFetch<SeatAvailability>(`/api/v1/public/preferred/seat-availability?${qs.toString()}`)
    },
    enabled:
      !!params &&
      !!params.state_lgd_code &&
      (params.level !== 'district_head' || !!params.district_lgd_code) &&
      (params.level !== 'block' || !!params.block_lgd_code),
  })
}

export async function submitApplication(
  kind: 'associate' | 'preferred',
  formData: FormData
): Promise<ApplyResponse> {
  return publicFetch<ApplyResponse>(`/api/v1/public/${kind === 'associate' ? 'associates' : 'preferred'}/apply`, {
    method: 'POST',
    body: formData,
  })
}

export function useVerifyAssociate(associateId: string) {
  return useQuery({
    queryKey: ['verify-associate', associateId],
    queryFn: () => publicFetch<VerifyAssociateResponse>(`/api/v1/public/verify/${encodeURIComponent(associateId)}`),
    enabled: !!associateId,
    retry: false,
  })
}

// ── Associate portal (associate/preferred Clerk token) ───────────────────────

export function useAssociateMe() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associate-me'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<AssociateMe>('/api/v1/associate/me', token)
    },
  })
}

export function useTerritoryMembers(params: TerritoryMemberListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['territory-members', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v))
      const q = qs.toString()
      return dashboardFetch<PaginatedTerritoryMembers>(`/api/v1/associate/territory/members${q ? `?${q}` : ''}`, token)
    },
    placeholderData: keepPreviousData,
  })
}

export async function fetchAssociateDocumentLink(
  document: 'id_card' | 'welcome_letter',
  token: string
): Promise<SignedDocumentLink> {
  return dashboardFetch(`/api/v1/associate/me/documents/${document}`, token)
}

// ── Admin: applications ───────────────────────────────────────────────────────

function buildQS(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export function useAssociateApplications(params?: ApplicationListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associate-applications', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedResponse<ApplicationListItem>>(`/api/v1/dashboard/associate-applications${qs}`, token)
    },
    staleTime: 60_000,
  })
}

export function useAssociateApplication(applicationType: ApplicationType, id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associate-application', applicationType, id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ApplicationDetail>(`/api/v1/dashboard/associate-applications/${applicationType}/${id}`, token)
    },
    enabled: !!id,
  })
}

export async function fetchApplicationDocumentLink(
  applicationType: ApplicationType,
  id: number,
  document: string,
  token: string
): Promise<SignedDocumentLink> {
  return dashboardFetch(`/api/v1/dashboard/associate-applications/${applicationType}/${id}/documents/${document}`, token)
}

export function useSetApplicationStatus() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      applicationType,
      id,
      status,
      note,
    }: {
      applicationType: ApplicationType
      id: number
      status: 'under_review' | 'needs_info' | 'rejected'
      note?: string
    }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch(`/api/v1/dashboard/associate-applications/${applicationType}/${id}/status`, token, {
        method: 'POST',
        body: JSON.stringify({ status, note }),
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['associate-application', vars.applicationType, vars.id] })
      void qc.invalidateQueries({ queryKey: ['associate-applications'] })
    },
  })
}

export function useApproveApplication() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      applicationType,
      id,
      verificationCallCompleted,
      verificationCallNote,
    }: {
      applicationType: ApplicationType
      id: number
      verificationCallCompleted: boolean
      verificationCallNote: string
    }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<{ application: ApplicationDetail; associate: AdminAssociate }>(
        `/api/v1/dashboard/associate-applications/${applicationType}/${id}/approve`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            verification_call_completed: verificationCallCompleted,
            verification_call_note: verificationCallNote,
          }),
        }
      )
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['associate-application', vars.applicationType, vars.id] })
      void qc.invalidateQueries({ queryKey: ['associate-applications'] })
      void qc.invalidateQueries({ queryKey: ['associates'] })
    },
  })
}

// ── Admin: associates ─────────────────────────────────────────────────────────

export function useAdminAssociates(params?: AssociateListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associates', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedResponse<AdminAssociate>>(`/api/v1/dashboard/associates${qs}`, token)
    },
    staleTime: 60_000,
  })
}

/** How long after approval the associate's invite and documents are still being prepared (BE-3, asynchronous). */
export const PREPARING_WINDOW_MS = 60_000
export const PREPARING_POLL_MS = 4_000

/**
 * Approval is asynchronous: right after it, `clerk_invite_status` is null and
 * there is no ID card yet. Only `'failed'` is a failure — null means "not done yet".
 */
export function isPreparing(a: Pick<AdminAssociate, 'clerk_invite_status' | 'documents' | 'approved_at'> | undefined, now = Date.now()): boolean {
  if (!a) return false
  // Only a fresh approval is "being prepared"; an old record with a null status is not polled forever.
  const approved = Date.parse(a.approved_at)
  if (Number.isFinite(approved) && now - approved > 15 * 60_000) return false
  return a.clerk_invite_status === null || !a.documents.id_card
}

export function useAdminAssociate(associateId: string, poll?: { until: number }) {
  const { getToken } = useAuth()
  return useQuery({
    // Re-read every few seconds, for up to about a minute, until the invite and ID card exist.
    refetchInterval: poll ? (query) => (isPreparing(query.state.data) && Date.now() < poll.until ? PREPARING_POLL_MS : false) : false,
    queryKey: ['associate', associateId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<AdminAssociate>(`/api/v1/dashboard/associates/${associateId}`, token)
    },
    enabled: !!associateId,
  })
}

export function useSetAssociateStatus() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      associateId,
      status,
      reason,
    }: {
      associateId: string
      status: AssociateStatus
      reason?: string
    }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<AssociateStatusChange>(`/api/v1/dashboard/associates/${associateId}/status`, token, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['associate', vars.associateId] })
      void qc.invalidateQueries({ queryKey: ['associates'] })
      void qc.invalidateQueries({ queryKey: ['territory-seats'] })
    },
  })
}

export function useRetryClerkInvite() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (associateId: string) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch(`/api/v1/dashboard/associates/${associateId}/clerk-invite`, token, { method: 'POST' })
    },
    onSuccess: (_data, associateId) => {
      void qc.invalidateQueries({ queryKey: ['associate', associateId] })
    },
  })
}

// Moves a suspended or deactivated associate's open customers to an active associate.
export function useAssociateCustomers(associateId: string) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associate', associateId, 'customers'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<AssociateCustomers>(`/api/v1/dashboard/associates/${encodeURIComponent(associateId)}/customers`, token)
    },
    enabled: !!associateId,
  })
}

export function useReassignCustomers() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ associateId, input }: { associateId: string; input: ReassignCustomersInput }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ReassignCustomersResult>(`/api/v1/dashboard/associates/${encodeURIComponent(associateId)}/reassign-customers`, token, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['associate'] })
      void qc.invalidateQueries({ queryKey: ['staff-onboardings'] })
    },
  })
}

export function useRegenerateAssociateDocuments() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (associateId: string) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch(`/api/v1/dashboard/associates/${associateId}/documents/regenerate`, token, { method: 'POST' })
    },
    onSuccess: (_data, associateId) => {
      void qc.invalidateQueries({ queryKey: ['associate', associateId] })
    },
  })
}

export async function fetchAdminAssociateDocumentLink(
  associateId: string,
  document: 'id_card' | 'welcome_letter',
  token: string
): Promise<SignedDocumentLink> {
  return dashboardFetch(`/api/v1/dashboard/associates/${associateId}/documents/${document}`, token)
}

// ── Admin: territories and seats ─────────────────────────────────────────────

export function useAdminTerritories(level: AdminTerritoryLevel, parentLgdCode?: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['admin-territories', level, parentLgdCode],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS({ parent_lgd_code: parentLgdCode })
      return dashboardFetch<{ items: AdminTerritoryItem[] }>(`/api/v1/dashboard/territories/${level}${qs}`, token).then(
        (r) => r.items
      )
    },
    enabled: level === 'states' || !!parentLgdCode,
  })
}

export type AdminTerritoryLevel = 'states' | 'districts' | 'blocks'

// POST /dashboard/territories/districts | blocks — add a territory missing from
// the seed data, by its official LGD code (Admin only). The 201 body has no
// documented schema, so nothing is read from it: the lists are refetched.
export type AddTerritoryInput =
  | { level: 'districts'; state_lgd_code: number; lgd_code: number; name: string }
  | { level: 'blocks'; district_lgd_code: number; lgd_code: number; name: string }

function invalidateTerritories(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['admin-territories'] })
  // A renamed / switched-off / added territory changes the registration pickers too.
  for (const key of ['territory-states', 'territory-districts', 'territory-blocks']) void qc.invalidateQueries({ queryKey: [key] })
}

export function useAddTerritory() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddTerritoryInput) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const { level, ...body } = input
      return dashboardFetch(`/api/v1/dashboard/territories/${level}`, token, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => invalidateTerritories(qc),
  })
}

// PATCH /dashboard/territories/{level}/{lgd_code} — rename, or switch off / on.
// Only `name` and `is_active` exist on the request: an LGD code is the identity
// and is never editable.
export function useUpdateTerritory() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ level, lgdCode, ...patch }: { level: AdminTerritoryLevel; lgdCode: number; name?: string; is_active?: boolean }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch(`/api/v1/dashboard/territories/${level}/${lgdCode}`, token, { method: 'PATCH', body: JSON.stringify(patch) })
    },
    onSuccess: () => invalidateTerritories(qc),
  })
}

export function useTerritorySeats(params: { state_lgd_code?: number; level?: AssociateLevel; include_released?: boolean }) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['territory-seats', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const qs = buildQS(params as Record<string, string | number | boolean | undefined | null>)
      return dashboardFetch<{ items: TerritorySeat[] }>(`/api/v1/dashboard/territory-seats${qs}`, token).then((r) => r.items)
    },
  })
}

export function useReleaseTerritorySeat() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ seatId, reason }: { seatId: number; reason: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch(`/api/v1/dashboard/territory-seats/${seatId}/release`, token, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['territory-seats'] })
      void qc.invalidateQueries({ queryKey: ['associates'] })
    },
  })
}
