import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Onboarding, OnboardingOptions } from '@/lib/associate/onboarding-types'

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

const copy = en.associates.portal.wizard

const OPTIONS: OnboardingOptions = {
  notice: { version: 'v1', text: 'Notice text' },
  equipment_packages: [{ key: 'dcr', label: 'DCR package', equipment_tier: 'standard' }],
  documents: [
    { key: 'electricity_bill', label: 'Electricity bill', required_when: null },
    { key: 'id_proof', label: 'ID proof', required_when: null },
  ],
  photo_slots: [{ key: 'front', label: 'Front of premises' }],
  customer_timelines: ['immediate'],
  attribution_lock_days: 7,
  site_location: { accuracy_good_m: 20, accuracy_warn_m: 50, accuracy_reject_m: 200, sample_seconds: 10, required_to_submit: true, sources: ['device_gps', 'photo_gps', 'google_maps_link', 'pasted_coordinates'], recommended_source: 'photo_gps' },
}

function existingOnboarding(over: Partial<Onboarding> = {}): Onboarding {
  return {
    onboarding_id: 501,
    status: 'draft',
    lead_id: 1,
    project_reference_id: null,
    owner: { associate_id: 'GNA-1', full_name: 'Asha Roy', associate_type: 'associate' },
    customer: { name: 'Bikash Das', mobile: '9800000000', email: null },
    territory: { state: { lgd_code: 19, name: 'West Bengal' }, district: null, block: null },
    site_latitude: null,
    site_longitude: null,
    site_location: { present: true, confirmed: true, latitude: 22.5726, longitude: 88.3639, source: 'device_gps', accuracy_m: 8, captured_at: '2026-01-01T00:00:00Z', verified: true, confirmed_at: '2026-01-01T00:00:00Z', confirmed_by: 'GNA-1', precision: null, flags: [], photo_distance_m: null, maps_url: 'https://www.google.com/maps?q=22.5726,88.3639' },
    connection_in_customer_name: true,
    property_in_customer_name: true,
    customer_timeline: 'immediate',
    site_assessment: null,
    documents: [],
    photos: [],
    checklist: { required: [], present: [], missing: [] },
    notice: { version: 'v1', acknowledged_at: '2026-01-01T00:00:00Z', recorded_by: 'GNA-1' },
    verification: { completed: false, verified_at: null },
    attribution: { locked_until: null, under_review: false },
    score: null,
    formal_proposal_blocked: null,
    submitted_at: null,
    warnings: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    can_edit: true,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
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

    await goToStep(user, 8) // notice -> ... -> house -> ... -> review
    expect(screen.getByText(copy.warnings.attribution_review)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.review.submitButton })).not.toBeDisabled()
  })
})

describe('OnboardingWizard — submit-time missing documents show translated labels', () => {
  it('maps each raw missing_documents key to its label from GET /options, not the raw key', async () => {
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

    await goToStep(user, 8)
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))

    expect(await screen.findByText('Electricity bill')).toBeInTheDocument()
    expect(screen.getByText('ID proof')).toBeInTheDocument()
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
    await goToStep(user, 6) // notice -> customer -> connection -> property -> requirement -> house -> documents

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
