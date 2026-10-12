import { notAuthenticatedError } from '@/lib/api/http'
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
  SetSiteLocationInput,
  SiteLocationResponse,
  UploadFileInput,
  UploadSignedAgreementInput,
} from './onboarding-types'

const BASE = '/api/v1/associate/onboardings'

// Transport lives in lib/api/http.ts; re-exported so existing imports keep working.
export { UPLOAD_STALL_TIMEOUT_MS, buildQS, apiFetchForm as dashboardFetchForm } from '@/lib/api/http'
import { apiFetchForm as dashboardFetchForm, buildQS } from '@/lib/api/http'

// ── Reference data ────────────────────────────────────────────────────────

export function useOnboardingOptions() {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['onboarding-options'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<CreateOnboardingResponse>(BASE, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
}

export function useUpdateOnboarding() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Record<string, unknown> }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<Onboarding>(`${BASE}/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
      // Survey fields ride on the PATCH (site_survey.md §1): status and results change with them.
      void qc.invalidateQueries({ queryKey: ['onboarding-survey', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboarding-survey-results', vars.id] })
    },
  })
}

export function useSubmitOnboarding() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<Onboarding>(`${BASE}/${id}/submit`, token, { method: 'POST' })
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', id] })
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
    },
  })
}

// ── Site location ─────────────────────────────────────────────────────────

// Owner only. Setting a location always leaves it unconfirmed; any change
// clears a prior confirmation, and a submitted customer returns to draft —
// the response is the whole onboarding, so callers just adopt it.
export function useSetSiteLocation() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: SetSiteLocationInput }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SiteLocationResponse>(`${BASE}/${id}/site-location`, token, { method: 'POST', body: JSON.stringify(input) })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
}

export function useConfirmSiteLocation() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SiteLocationResponse>(`${BASE}/${id}/site-location/confirm`, token, { method: 'POST' })
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['onboarding', id] })
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
}

// ── Files ─────────────────────────────────────────────────────────────────

// Multipart body shared by every file/photo upload endpoint (onboarding and
// execution use the same field names).
export function buildUploadForm(input: UploadFileInput): FormData {
  const formData = new FormData()
  formData.set('file', input.file)
  formData.set('kind', input.kind)
  if (input.document_type) formData.set('document_type', input.document_type)
  if (input.photo_slot) formData.set('photo_slot', input.photo_slot)
  if (input.latitude !== undefined) formData.set('latitude', String(input.latitude))
  if (input.longitude !== undefined) formData.set('longitude', String(input.longitude))
  if (input.captured_at) formData.set('captured_at', input.captured_at)
  if (input.capture_method) formData.set('capture_method', input.capture_method)
  if (input.accuracy_m !== undefined && input.accuracy_m > 0) formData.set('accuracy_m', String(input.accuracy_m))
  if (input.exif_taken_at_client) formData.set('exif_taken_at_client', input.exif_taken_at_client)
  return formData
}

export function useUploadOnboardingFile() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UploadFileInput }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      const formData = buildUploadForm(input)
      return dashboardFetchForm<Onboarding>(`${BASE}/${id}/files`, token, formData, input.onProgress)
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
      if (!token) throw notAuthenticatedError()
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
