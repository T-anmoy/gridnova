import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buildQS, dashboardFetch } from '@/lib/dashboard/api-client'
import { surveyReportLinkSchema, surveyResultsSchema, surveyStatusSchema } from '@/lib/associate/survey-schemas'
import type { SurveyReportLink, SurveyResults, SurveyStatus } from '@/lib/associate/survey-types'
import type {
  ClearReverificationResponse,
  DecideCorrectionResponse,
  GenerateSurveyReportResponse,
  SubmitSurveyReviewInput,
  SurveyCorrectionQueue,
  SurveyCorrectionQueueParams,
  SurveyReviewQueue,
  SurveyReviewQueueParams,
} from './survey-review-types'

const BASE = '/api/v1/dashboard'

export const staffSurveyKey = (id: number) => ['staff-onboarding-survey', id] as const
export const staffSurveyResultsKey = (id: number) => ['staff-onboarding-survey-results', id] as const

// Queue counts live in several places: the nav badges, both queues and the panel.
function invalidateQueues(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['work-queues'] })
  void qc.invalidateQueries({ queryKey: ['survey-review-queue'] })
  void qc.invalidateQueries({ queryKey: ['survey-correction-queue'] })
}

/** §3 — admin, management, sales (own/unassigned), engineer. */
export function useStaffSurvey(id: number, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: staffSurveyKey(id),
    queryFn: async ({ signal }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyStatus>(`${BASE}/onboardings/${id}/survey`, token, { signal }, surveyStatusSchema)
    },
    enabled: !!id && enabled,
  })
}

/** §4 — live; an Engineer's response carries no `estimate`. */
export function useStaffSurveyResults(id: number, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: staffSurveyResultsKey(id),
    queryFn: async ({ signal }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyResults>(`${BASE}/onboardings/${id}/survey/results`, token, { signal }, surveyResultsSchema)
    },
    enabled: !!id && enabled,
  })
}

/** §8 — admin, engineer. 200 → the staff survey status with the new review. */
export function useSubmitSurveyReview() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: SubmitSurveyReviewInput }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyStatus>(`${BASE}/onboardings/${id}/survey/review`, token, { method: 'POST', body: JSON.stringify(input) }, surveyStatusSchema)
    },
    onSuccess: (status, vars) => {
      qc.setQueryData(staffSurveyKey(vars.id), status)
      invalidateQueues(qc)
    },
  })
}

/** §10 — admin, engineer. Every call stores a new file; the old one is kept. */
export function useGenerateSurveyReport() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<GenerateSurveyReportResponse>(`${BASE}/onboardings/${id}/survey/report`, token, { method: 'POST' })
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: staffSurveyKey(id) })
    },
  })
}

/** A fresh signed link on every click — never cached in the page. */
export async function fetchStaffSurveyReportLink(id: number, token: string): Promise<SurveyReportLink> {
  return dashboardFetch<SurveyReportLink>(`${BASE}/onboardings/${id}/survey/report`, token, undefined, surveyReportLinkSchema)
}

// ── Queues ────────────────────────────────────────────────────────────────

export function useSurveyReviewQueue(params: SurveyReviewQueueParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['survey-review-queue', params],
    queryFn: async ({ signal }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyReviewQueue>(`${BASE}/survey-reviews${buildQS({ ...params })}`, token, { signal })
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useSurveyCorrectionQueue(params: SurveyCorrectionQueueParams) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: ['survey-correction-queue', params],
    queryFn: async ({ signal }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyCorrectionQueue>(`${BASE}/survey-corrections${buildQS({ ...params })}`, token, { signal })
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

/** §9 — admin, engineer; never the requester (403 `segregation_of_duties`). */
export function useDecideSurveyCorrection() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: number; decision: 'apply' | 'reject'; note?: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<DecideCorrectionResponse>(`${BASE}/survey-corrections/${id}/${decision}`, token, {
        method: 'POST',
        body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
      })
    },
    onSuccess: () => {
      invalidateQueues(qc)
      // An applied correction changes the survey and flags proposals.
      void qc.invalidateQueries({ queryKey: ['staff-onboarding-survey'] })
      void qc.invalidateQueries({ queryKey: ['proposals'] })
      void qc.invalidateQueries({ queryKey: ['proposal'] })
    },
  })
}

/** §9 — admin, management, engineer; never the one who applied the correction. */
export function useClearReverification() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ proposalId, note }: { proposalId: number; note: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<ClearReverificationResponse>(`${BASE}/proposals/${proposalId}/reverification/clear`, token, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() }),
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['proposal', vars.proposalId] })
      void qc.invalidateQueries({ queryKey: ['proposals'] })
    },
  })
}
