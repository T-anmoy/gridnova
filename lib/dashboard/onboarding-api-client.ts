import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from './api-client'
import { dashboardFetchForm } from '@/lib/associate/onboarding-api-client'
import type {
  AgreementResponse,
  FormalProposalReadResponse,
  InPersonAcceptanceInput,
  InPersonAcceptanceResponse,
  Onboarding,
  ProgressResponse,
  UploadSignedAgreementInput,
} from '@/lib/associate/onboarding-types'
import type {
  AttributionFlag,
  AttributionFlagListParams,
  EstimateListResponse,
  PaginatedOnboardings,
  PortalAgreementApprovedInput,
  PrepareFormalProposalInput,
  PrepareFormalProposalResponse,
  ResolveAttributionFlagInput,
  StaffOnboardingListParams,
  VerificationCallInput,
} from './onboarding-types'

const BASE = '/api/v1/dashboard/onboardings'

function buildQS(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// ── List / detail ─────────────────────────────────────────────────────────

export function useStaffOnboardings(params?: StaffOnboardingListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-onboardings', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | number | boolean | undefined | null>) ?? {})
      return dashboardFetch<PaginatedOnboardings>(`${BASE}${qs}`, token)
    },
    staleTime: 30_000,
  })
}

export function useStaffOnboarding(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-onboarding', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Onboarding>(`${BASE}/${id}`, token)
    },
    enabled: !!id,
  })
}

// ── Verification call ────────────────────────────────────────────────────

export function useVerificationCall() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: VerificationCallInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<Onboarding>(`${BASE}/${id}/verification-call`, token, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['staff-onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboardings'] })
    },
  })
}

// ── Progress ──────────────────────────────────────────────────────────────

export function useStaffOnboardingProgress(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-onboarding-progress', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<ProgressResponse>(`${BASE}/${id}/progress`, token)
    },
    enabled: !!id,
  })
}

export function usePortalAgreementApproved() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: PortalAgreementApprovedInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<ProgressResponse>(`${BASE}/${id}/progress/portal_agreement_approved`, token, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-progress', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboarding', vars.id] })
    },
  })
}

// ── Estimates (read-only) ────────────────────────────────────────────────

export function useStaffOnboardingEstimates(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-onboarding-estimates', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<EstimateListResponse>(`${BASE}/${id}/estimates`, token).then((r) => r.items)
    },
    enabled: !!id,
  })
}

// ── Formal proposal (prepare) ────────────────────────────────────────────

export function usePrepareFormalProposal() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input?: PrepareFormalProposalInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<PrepareFormalProposalResponse>(`${BASE}/${id}/formal-proposal`, token, {
        method: 'POST',
        body: JSON.stringify(input ?? {}),
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['staff-onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-progress', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-formal-proposal', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboardings'] })
    },
  })
}

export function useStaffOnboardingFormalProposal(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-onboarding-formal-proposal', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<FormalProposalReadResponse>(`${BASE}/${id}/formal-proposal`, token)
    },
    enabled: !!id,
  })
}

// ── In-person acceptance ─────────────────────────────────────────────────

export function useStaffInPersonAcceptance() {
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
      void qc.invalidateQueries({ queryKey: ['staff-onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-progress', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-formal-proposal', vars.id] })
    },
  })
}

// ── Agreement ─────────────────────────────────────────────────────────────

export function useStaffOnboardingAgreement(id: number) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['staff-onboarding-agreement', id],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<AgreementResponse>(`${BASE}/${id}/agreement`, token)
    },
    enabled: !!id,
  })
}

export function useUploadStaffSignedAgreement() {
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
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-agreement', vars.id] })
      void qc.invalidateQueries({ queryKey: ['staff-onboarding', vars.id] })
    },
  })
}

export function useGenerateAgreement() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch(`${BASE}/${id}/agreement`, token, { method: 'POST' })
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-agreement', id] })
    },
  })
}

// ── Attribution flags ─────────────────────────────────────────────────────

export function useAttributionFlags(params?: AttributionFlagListParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['attribution-flags', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const qs = buildQS((params as Record<string, string | undefined>) ?? {})
      return dashboardFetch<{ items: AttributionFlag[] }>(`/api/v1/dashboard/attribution-flags${qs}`, token).then(
        (r) => r.items
      )
    },
  })
}

export function useResolveAttributionFlag() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ flagId, input }: { flagId: number; input: ResolveAttributionFlagInput }) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return dashboardFetch<AttributionFlag>(`/api/v1/dashboard/attribution-flags/${flagId}/resolve`, token, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attribution-flags'] })
      void qc.invalidateQueries({ queryKey: ['staff-onboardings'] })
    },
  })
}
