import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import type {
  AgreementResponse,
  CreateEstimateInput,
  CreateOnboardingInput,
  CreateOnboardingResponse,
  Estimate,
  EstimateListResponse,
  FileLinkResponse,
  FormalProposalReadResponse,
  InPersonAcceptanceInput,
  InPersonAcceptanceResponse,
  Onboarding,
  OnboardingListParams,
  OnboardingOptions,
  PaginatedOnboardings,
  ProgressResponse,
  RequestFormalProposalResponse,
  UploadFileInput,
  UploadSignedAgreementInput,
} from './onboarding-types'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const BASE = '/api/v1/associate/onboardings'

function buildQS(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// Multipart uploads (files, signed scans) can't go through dashboardFetch's
// JSON-only body handling — this mirrors its auth/error handling for
// FormData instead. Exported so the staff-side dashboard onboarding client
// (which shares this same signed-agreement endpoint shape) doesn't need its
// own copy.
export async function dashboardFetchForm<T>(path: string, token: string, formData: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
  } catch {
    const { ApiError } = await import('@/lib/dashboard/api-error')
    throw new ApiError(0, 'Network request failed')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let detail = body
    let structuredDetail: Record<string, unknown> | undefined
    try {
      const parsed = JSON.parse(body) as { detail?: unknown }
      const d = parsed.detail
      if (typeof d === 'string' && d) {
        detail = d
      } else if (d && typeof d === 'object') {
        structuredDetail = d as Record<string, unknown>
        const msg = (d as Record<string, unknown>).message
        detail = typeof msg === 'string' ? msg : res.statusText
      }
    } catch {
      /* not JSON */
    }
    const { ApiError } = await import('@/lib/dashboard/api-error')
    throw new ApiError(res.status, `API error ${res.status}`, detail || res.statusText, structuredDetail)
  }
  return (await res.json()) as T
}

// ── Reference data ────────────────────────────────────────────────────────

export function useOnboardingOptions() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboarding-options'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<OnboardingOptions>(`${BASE}/options`, token)
    },
    staleTime: 5 * 60_000,
  })
}

// ── List / detail ─────────────────────────────────────────────────────────

export function useOnboardings(params?: OnboardingListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboardings', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedOnboardings>(`${BASE}${qs}`, token)
    },
    staleTime: 30_000,
  })
}

export function useOnboarding(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboarding', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Onboarding>(`${BASE}/${id}`, token)
    },
    enabled: !!id,
  })
}

// ── Create / update / submit ─────────────────────────────────────────────

export function useCreateOnboarding() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateOnboardingInput) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<CreateOnboardingResponse>(BASE, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
    },
  })
}

export function useUpdateOnboarding() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Record<string, unknown> }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Onboarding>(`${BASE}/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
    },
  })
}

export function useSubmitOnboarding() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Onboarding>(`${BASE}/${id}/submit`, token, { method: 'POST' })
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', id] })
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
    },
  })
}

// ── Files ─────────────────────────────────────────────────────────────────

export function useUploadOnboardingFile() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UploadFileInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const formData = new FormData()
      formData.set('file', input.file)
      formData.set('kind', input.kind)
      if (input.document_type) formData.set('document_type', input.document_type)
      if (input.photo_slot) formData.set('photo_slot', input.photo_slot)
      if (input.latitude !== undefined) formData.set('latitude', String(input.latitude))
      if (input.longitude !== undefined) formData.set('longitude', String(input.longitude))
      if (input.captured_at) formData.set('captured_at', input.captured_at)
      return dashboardFetchForm<Onboarding>(`${BASE}/${id}/files`, token, formData)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', vars.id] })
    },
  })
}

export async function fetchOnboardingFileLink(id: number, fileRef: string, token: string): Promise<FileLinkResponse> {
  return dashboardFetch(`${BASE}/${id}/files/${fileRef}`, token)
}

// ── Progress ──────────────────────────────────────────────────────────────

export function useOnboardingProgress(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboarding-progress', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<ProgressResponse>(`${BASE}/${id}/progress`, token)
    },
    enabled: !!id,
  })
}

// ── Estimates ─────────────────────────────────────────────────────────────

export function useCreateEstimate() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: CreateEstimateInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Estimate>(`${BASE}/${id}/estimates`, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['onboarding-estimates', vars.id] })
    },
  })
}

export function useOnboardingEstimates(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboarding-estimates', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<EstimateListResponse>(`${BASE}/${id}/estimates`, token).then((r) => r.items)
    },
    enabled: !!id,
  })
}

// ── Formal proposal ──────────────────────────────────────────────────────

export function useRequestFormalProposal() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<RequestFormalProposalResponse>(`${BASE}/${id}/request-formal-proposal`, token, { method: 'POST' })
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', id] })
      void qc.invalidateQueries({ queryKey: ['onboarding-progress', id] })
      void qc.invalidateQueries({ queryKey: ['onboarding-formal-proposal', id] })
    },
  })
}

export function useOnboardingFormalProposal(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboarding-formal-proposal', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<FormalProposalReadResponse>(`${BASE}/${id}/formal-proposal`, token)
    },
    enabled: !!id,
  })
}

// ── In-person acceptance ─────────────────────────────────────────────────

export function useInPersonAcceptance() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: InPersonAcceptanceInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<InPersonAcceptanceResponse>(`${BASE}/${id}/proposal/in-person-acceptance`, token, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboarding-progress', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboarding-formal-proposal', vars.id] })
    },
  })
}

// ── Agreement ─────────────────────────────────────────────────────────────

export function useOnboardingAgreement(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboarding-agreement', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<AgreementResponse>(`${BASE}/${id}/agreement`, token)
    },
    enabled: !!id,
  })
}

export function useUploadSignedAgreement() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UploadSignedAgreementInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const formData = new FormData()
      formData.set('file', input.file)
      formData.set('stamp_paper_number', input.stamp_paper_number)
      formData.set('stamp_paper_date', input.stamp_paper_date)
      return dashboardFetchForm<AgreementResponse>(`${BASE}/${id}/agreement/signed`, token, formData)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['onboarding-agreement', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboarding', vars.id] })
    },
  })
}
