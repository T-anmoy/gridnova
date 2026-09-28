import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/dashboard/api-error'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import type {
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
  KycConsent,
  PaginatedTerritoryMembers,
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

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Shared plain fetch (no auth) for the public surface ──────────────────────

async function publicFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}${path}`, options)
  } catch {
    throw new ApiError(0, 'Network request failed')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let detail: unknown = body
    try {
      const parsed = JSON.parse(body) as { detail?: unknown }
      detail = parsed.detail ?? body
    } catch {
      /* not JSON — keep raw text */
    }
    const structuredDetail =
      detail && typeof detail === 'object' && !Array.isArray(detail) ? (detail as Record<string, unknown>) : undefined
    const message =
      typeof detail === 'string'
        ? detail
        : structuredDetail && typeof structuredDetail.message === 'string'
          ? structuredDetail.message
          : res.statusText
    throw new ApiError(res.status, `API error ${res.status}`, message, structuredDetail ?? (Array.isArray(detail) ? { fieldErrors: detail } : undefined))
  }
  return (await res.json()) as T
}

// ── Public reference data ────────────────────────────────────────────────────

export function useTerritoryStates() {
  return useQuery({
    queryKey: ['territory-states'],
    queryFn: () => publicFetch<{ items: TerritoryState[] }>('/api/v1/public/territories/states').then((r) => r.items),
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
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
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedResponse<AdminAssociate>>(`/api/v1/dashboard/associates${qs}`, token)
    },
    staleTime: 60_000,
  })
}

export function useAdminAssociate(associateId: string) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['associate', associateId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<AdminAssociate>(`/api/v1/dashboard/associates/${associateId}/status`, token, {
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
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch(`/api/v1/dashboard/associates/${associateId}/clerk-invite`, token, { method: 'POST' })
    },
    onSuccess: (_data, associateId) => {
      void qc.invalidateQueries({ queryKey: ['associate', associateId] })
    },
  })
}

export function useRegenerateAssociateDocuments() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (associateId: string) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
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

export function useAdminTerritories(level: 'states' | 'districts' | 'blocks', parentLgdCode?: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['admin-territories', level, parentLgdCode],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS({ parent_lgd_code: parentLgdCode })
      return dashboardFetch<{ items: AdminTerritoryItem[] }>(`/api/v1/dashboard/territories/${level}${qs}`, token).then(
        (r) => r.items
      )
    },
    enabled: level === 'states' || !!parentLgdCode,
  })
}

export function useTerritorySeats(params: { state_lgd_code?: number; level?: AssociateLevel; include_released?: boolean }) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['territory-seats', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
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
      if (!token) throw new Error('Not authenticated')
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
