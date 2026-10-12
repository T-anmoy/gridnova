import { vi } from 'vitest'

// Shared, configurable stand-ins for the survey hooks and the signed-in user.
// Use from a test file with:
//   vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
//   vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
export const surveyMocks = {
  status: vi.fn((): { data?: unknown; isLoading?: boolean; error?: unknown; refetch?: () => void } => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })),
  results: vi.fn((): { data?: unknown; isLoading?: boolean; error?: unknown; refetch?: () => void } => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })),
  corrections: vi.fn((): { data?: unknown; isLoading?: boolean; error?: unknown } => ({ data: { items: [] }, isLoading: false, error: null })),
  requestCorrection: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  reportLink: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ url: 'https://files.example/report.pdf', expires_at: '', filename: 'r.pdf', generated_at: '' })),
  refresh: vi.fn(async (): Promise<unknown> => undefined),
  sign: vi.fn(async (): Promise<unknown> => ({})),
  signPending: false,
  userId: 'user_1' as string | null,
}

export function resetSurveyMocks() {
  surveyMocks.status.mockReset().mockImplementation(() => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }))
  surveyMocks.results.mockReset().mockImplementation(() => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }))
  surveyMocks.corrections.mockReset().mockImplementation(() => ({ data: { items: [] }, isLoading: false, error: null }))
  surveyMocks.refresh.mockReset().mockImplementation(async () => undefined)
  surveyMocks.sign.mockReset().mockImplementation(async () => ({}))
  surveyMocks.signPending = false
  surveyMocks.userId = 'user_1'
}

export const surveyClientModule = {
  surveyStatusKey: (id: number) => ['onboarding-survey', id],
  surveyResultsKey: (id: number) => ['onboarding-survey-results', id],
  useSurveyStatus: () => surveyMocks.status(),
  useSurveyResults: () => surveyMocks.results(),
  surveyCorrectionsKey: (id: number) => ['onboarding-survey-corrections', id],
  useSurveyCorrections: () => surveyMocks.corrections(),
  useRequestSurveyCorrection: () => ({ mutateAsync: surveyMocks.requestCorrection, isPending: false }),
  fetchSurveyReportLink: (...a: unknown[]) => surveyMocks.reportLink(...a),
  useRefreshSurvey: () => surveyMocks.refresh,
  useSignSurvey: () => ({ mutateAsync: surveyMocks.sign, isPending: surveyMocks.signPending }),
}

export const portalSessionOverrides = {
  useDraftUserId: () => ({ userId: surveyMocks.userId, ready: true }),
}
