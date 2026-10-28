import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Onboarding, OnboardingOptions } from '@/lib/associate/onboarding-types'
import { ONBOARDING_OPTIONS, makeOnboarding } from './fixtures/survey-contract'
import { resetSurveyMocks } from './helpers/survey-mocks'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const mockUseOnboardingOptions = vi.fn()
const mockUseCreateOnboarding = vi.fn()
const mockUseUpdateOnboarding = vi.fn()
const mockUseUploadOnboardingFile = vi.fn()
const mockUseSubmitOnboarding = vi.fn()
const mockUseSetSiteLocation = vi.fn()
const mockUseConfirmSiteLocation = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingOptions: () => mockUseOnboardingOptions(),
  useCreateOnboarding: () => mockUseCreateOnboarding(),
  useUpdateOnboarding: () => mockUseUpdateOnboarding(),
  useUploadOnboardingFile: () => mockUseUploadOnboardingFile(),
  useSubmitOnboarding: () => mockUseSubmitOnboarding(),
  useSetSiteLocation: () => mockUseSetSiteLocation(),
  useConfirmSiteLocation: () => mockUseConfirmSiteLocation(),
}))

vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, iso_code: "WB", name: "West Bengal" }, { lgd_code: 10, iso_code: "BR", name: "Bihar" }] }),
  useTerritoryDistricts: () => ({ data: [] }),
  useTerritoryBlocks: () => ({ data: [] }),
}))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))

const copy = en.associates.portal.wizard

const OPTIONS: OnboardingOptions = {
  ...ONBOARDING_OPTIONS,
  documents: [
    { key: 'electricity_bill', label: 'Electricity bill', required_when: null },
    { key: 'id_proof', label: 'ID proof', required_when: null },
  ],
  photo_slots: [{ key: 'front', label: 'Front of premises' }],
}

function existingOnboarding(over: Partial<Onboarding> = {}): Onboarding {
  return makeOnboarding({
    site_location: { present: true, confirmed: true, latitude: 22.5726, longitude: 88.3639, source: 'device_gps', accuracy_m: 8, captured_at: '2026-01-01T00:00:00Z', verified: true, confirmed_at: '2026-01-01T00:00:00Z', confirmed_by: 'GNA-1', precision: null, flags: [], photo_distance_m: null, maps_url: 'https://www.google.com/maps?q=22.5726,88.3639' },
    ...over,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  window.localStorage.clear()
  mockUseOnboardingOptions.mockReturnValue({ data: OPTIONS, isLoading: false })
  mockUseCreateOnboarding.mockReturnValue({ mutateAsync: vi.fn() })
  mockUseUpdateOnboarding.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}) })
  mockUseSetSiteLocation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUseConfirmSiteLocation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
})

async function goToStep(user: ReturnType<typeof userEvent.setup>, count: number) {
  for (let i = 0; i < count; i++) {
    await user.click(screen.getByRole('button', { name: copy.continueButton }))
  }
}

describe('OnboardingWizard — warnings never block submission', () => {
  it('a warning stays visible at every step but never disables Continue or Submit', async () => {
    mockUseUploadOnboardingFile.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}) })
    mockUseSubmitOnboarding.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })
    const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
    const user = userEvent.setup()
    render(
      withI18n(
        <OnboardingWizard
          territory={en.associates.territory}
          copy={copy}
          portalBase="/associates/portal"
          existing={existingOnboarding({ onboarding_id: 601, warnings: [{ code: 'attribution_review', message: 'x' }] })}
        />
      )
    )
    expect(screen.getByText(copy.warnings.attribution_review)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.continueButton })).not.toBeDisabled()

    await goToStep(user, 11) // notice -> … -> house -> layout -> documents -> photos -> survey -> review
    expect(screen.getByText(copy.warnings.attribution_review)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.review.submitButton })).not.toBeDisabled()
  })
})

describe('OnboardingWizard — submit-time missing documents show translated labels', () => {
  it('maps each raw missing_documents key to its translated name by code (BE-20), not the raw key nor the English label', async () => {
    mockUseUploadOnboardingFile.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}) })
    mockUseSubmitOnboarding.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(
        new ApiError(422, 'API error 422', 'Upload every required document', {
          code: 'incomplete',
          message: 'Upload every required document before submitting',
          missing_documents: ['electricity_bill', 'id_proof'],
        })
      ),
      isPending: false,
    })
    const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
    const user = userEvent.setup()
    render(withI18n(<OnboardingWizard copy={copy} territory={en.associates.territory} portalBase="/associates/portal" existing={existingOnboarding({ onboarding_id: 602 })} />))

    await goToStep(user, 11)
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))

    // Translated by code from the portal copy — the options' English label ("Electricity bill") is only a fallback.
    expect(await screen.findByText(copy.documents.typeLabels.electricity_bill)).toBeInTheDocument()
    expect(screen.getByText(copy.documents.typeLabels.id_proof)).toBeInTheDocument()
    expect(screen.queryByText('electricity_bill')).not.toBeInTheDocument()
    expect(screen.queryByText('id_proof')).not.toBeInTheDocument()
  })
})

describe('OnboardingWizard — a document only counts as attached once its upload succeeds', () => {
  it('shows an error + retry on failure, then attaches only once the retry succeeds', async () => {
    const uploadMutateAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({})
    mockUseUploadOnboardingFile.mockReturnValue({ mutateAsync: uploadMutateAsync })
    mockUseSubmitOnboarding.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
    const user = userEvent.setup()
    const { container } = render(
      withI18n(<OnboardingWizard copy={copy} territory={en.associates.territory} portalBase="/associates/portal" existing={existingOnboarding({ onboarding_id: 603 })} />)
    )
    await goToStep(user, 8) // notice -> customer -> connection -> bills -> property -> requirement -> house -> layout -> documents

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'bill.pdf', { type: 'application/pdf' })
    await user.upload(input, file)

    expect(await screen.findByText(copy.documents.uploadFailed)).toBeInTheDocument()
    // Not shown as attached (the "Replace" caption) while it failed.
    expect(screen.queryByText(copy.documents.replaceButton)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: copy.documents.retryButton }))

    await waitFor(() => expect(screen.getByText(copy.documents.replaceButton)).toBeInTheDocument())
    expect(screen.queryByText(copy.documents.uploadFailed)).not.toBeInTheDocument()
    expect(uploadMutateAsync).toHaveBeenCalledTimes(2)
  })
})
