import { notAuthenticatedError } from '@/lib/api/http'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { dashboardFetchForm } from './onboarding-api-client'
import { surveyCorrectionListSchema, surveyCorrectionSchema, surveyReportLinkSchema, surveyResultsSchema, surveyStatusSchema } from './survey-schemas'
import type { SignSurveyInput, SurveyCorrection, SurveyReportLink, SurveyResults, SurveyStatus } from './survey-types'

// Associate site-survey routes (site_survey.md §3–§5). Survey FIELDS are not
// here: they are written through the onboarding create/PATCH (§1).

const BASE = '/api/v1/associate/onboardings'

export const surveyStatusKey = (id: number) => ['onboarding-survey', id] as const
export const surveyResultsKey = (id: number) => ['onboarding-survey-results', id] as const
export const surveyCorrectionsKey = (id: number) => ['onboarding-survey-corrections', id] as const

/** Owner, or a Preferred Associate whose territory holds the site (read-only). */
export function useSurveyStatus(id: number | undefined) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: surveyStatusKey(id ?? 0),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyStatus>(`${BASE}/${id}/survey`, token, undefined, surveyStatusSchema)
    },
    enabled: !!id,
  })
}

/** Live, never stored (§4) — refetched whenever the survey changes. */
export function useSurveyResults(id: number | undefined, enabled = true) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: surveyResultsKey(id ?? 0),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyResults>(`${BASE}/${id}/survey/results`, token, undefined, surveyResultsSchema)
    },
    enabled: !!id && enabled,
  })
}

/** Refresh both survey reads after any survey edit; resolves with the fresh status. */
export function useRefreshSurvey() {
  const qc = useQueryClient()
  return async (id: number): Promise<SurveyStatus | undefined> => {
    void qc.invalidateQueries({ queryKey: surveyResultsKey(id) })
    await qc.invalidateQueries({ queryKey: surveyStatusKey(id) })
    return qc.getQueryData<SurveyStatus>(surveyStatusKey(id))
  }
}

export function buildSignatureForm(input: SignSurveyInput): FormData {
  const form = new FormData()
  form.set('file', input.file, `${input.party}-signature.png`)
  if (input.party === 'customer') {
    form.set('declaration_name', input.declaration_name ?? '')
    form.set('customer_confirms_data', input.customer_confirms_data ? 'true' : 'false')
  }
  return form
}

/** Owner only. 201 → the survey status (§3). Needs a connection — never queued. */
export function useSignSurvey() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: SignSurveyInput }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetchForm<SurveyStatus>(`${BASE}/${id}/survey/signatures/${input.party}`, token, buildSignatureForm(input))
    },
    onSuccess: (status, vars) => {
      qc.setQueryData(surveyStatusKey(vars.id), status)
      // Signing a submitted customer returns it to draft (§5); the home to-do list changes too.
      void qc.invalidateQueries({ queryKey: ['home'] })
      void qc.invalidateQueries({ queryKey: ['onboarding', vars.id] })
      void qc.invalidateQueries({ queryKey: ['onboardings'] })
    },
  })
}

// ── Corrections (§9) ──────────────────────────────────────────────────────

/** Owner and territory Preferred (read): newest first, every status. */
export function useSurveyCorrections(id: number | undefined) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: surveyCorrectionsKey(id ?? 0),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<{ items: SurveyCorrection[] }>(`${BASE}/${id}/survey/corrections`, token, undefined, surveyCorrectionListSchema)
    },
    enabled: !!id,
  })
}

/** Owner only, verified customer only. 201 → the pending request. */
export function useRequestSurveyCorrection() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, changes, reason }: { id: number; changes: Record<string, unknown>; reason: string }) => {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      return dashboardFetch<SurveyCorrection>(`${BASE}/${id}/survey/corrections`, token, { method: 'POST', body: JSON.stringify({ changes, reason }) }, surveyCorrectionSchema)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: surveyCorrectionsKey(vars.id) })
    },
  })
}

// ── Report (§10) ──────────────────────────────────────────────────────────

/**
 * A fresh signed link for the latest report. Signed links expire, so this is
 * fetched on every click and never cached in the page.
 */
export async function fetchSurveyReportLink(id: number, token: string): Promise<SurveyReportLink> {
  return dashboardFetch<SurveyReportLink>(`${BASE}/${id}/survey/report`, token, undefined, surveyReportLinkSchema)
}
