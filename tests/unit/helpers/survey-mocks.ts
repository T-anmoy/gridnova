import { vi } from 'vitest'

// Shared, configurable stand-ins for the survey hooks and the signed-in user.
// Use from a test file with:
//   vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
//   vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
export const surveyMocks = {
  status: vi.fn((): { data?: unknown; isLoading?: boolean; error?: unknown; refetch?: () => void } => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })),
  results: vi.fn((): { data?: unknown; isLoading?: boolean; error?: unknown; refetch?: () => void } => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })),
  refresh: vi.fn(async (): Promise<unknown> => undefined),
  sign: vi.fn(async (): Promise<unknown> => ({})),
  signPending: false,
  userId: 'user_1' as string | null,
}

export function resetSurveyMocks() {
  surveyMocks.status.mockReset().mockImplementation(() => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }))
  surveyMocks.results.mockReset().mockImplementation(() => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }))
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
  useRefreshSurvey: () => surveyMocks.refresh,
  useSignSurvey: () => ({ mutateAsync: surveyMocks.sign, isPending: surveyMocks.signPending }),
}

export const portalSessionOverrides = {
  useDraftUserId: () => ({ userId: surveyMocks.userId, ready: true }),
}
