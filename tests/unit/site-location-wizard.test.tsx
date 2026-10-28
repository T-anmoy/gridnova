import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Onboarding, OnboardingOptions, SiteLocation } from '@/lib/associate/onboarding-types'
import { ONBOARDING_OPTIONS, makeOnboarding } from './fixtures/survey-contract'
import { resetSurveyMocks } from './helpers/survey-mocks'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const mockOptions = vi.fn()
const setMutateAsync = vi.fn()
const confirmMutateAsync = vi.fn()
const submitMutateAsync = vi.fn()
const uploadMutateAsync = vi.fn()
const prepare = vi.fn()
vi.mock('@/lib/associate/image-prep', async (orig) => ({ ...(await orig<typeof import('@/lib/associate/image-prep')>()), prepareImage: (f: File) => prepare(f) }))
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingOptions: () => mockOptions(),
  useCreateOnboarding: () => ({ mutateAsync: vi.fn() }),
  useUpdateOnboarding: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useUploadOnboardingFile: () => ({ mutateAsync: uploadMutateAsync }),
  useSubmitOnboarding: () => ({ mutateAsync: submitMutateAsync, isPending: false }),
  useSetSiteLocation: () => ({ mutateAsync: setMutateAsync, isPending: false }),
  useConfirmSiteLocation: () => ({ mutateAsync: confirmMutateAsync, isPending: false }),
}))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, iso_code: 'WB', name: 'West Bengal' }] }),
  useTerritoryDistricts: () => ({ data: [] }),
  useTerritoryBlocks: () => ({ data: [] }),
}))

import OnboardingWizard from '@/components/associate/OnboardingWizard'

const copy = en.associates.portal.wizard
const m = en.siteLocation

const OPTIONS: OnboardingOptions = ONBOARDING_OPTIONS
const NOT_SET: SiteLocation = { present: false, confirmed: false, flags: ['location_missing'] }
const UNCONFIRMED: SiteLocation = { present: true, confirmed: false, latitude: 22.5726, longitude: 88.3639, source: 'pasted_coordinates', accuracy_m: null, verified: false, flags: ['unverified_source', 'accuracy_unknown'], maps_url: 'https://www.google.com/maps?q=22.5726,88.3639' }
const CONFIRMED: SiteLocation = { ...UNCONFIRMED, confirmed: true }

function onboarding(over: Partial<Onboarding> = {}): Onboarding {
  return makeOnboarding({ site_location: NOT_SET, ...over })
}
const resp = (site_location: SiteLocation) => onboarding({ site_location })

function renderWizard(existing: Onboarding, extra: Partial<React.ComponentProps<typeof OnboardingWizard>> = {}) {
  window.localStorage.clear()
  return render(withI18n(<OnboardingWizard copy={copy} territory={en.associates.territory} portalBase="/associates/portal" existing={existing} {...extra} />))
}

async function goTo(user: ReturnType<typeof userEvent.setup>, clicks: number) {
  for (let i = 0; i < clicks; i++) await user.click(screen.getByRole('button', { name: copy.continueButton }))
}
const HOUSE_CLICKS = 6 // notice → customer → connection → bills → property → requirement → house

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  uploadMutateAsync.mockResolvedValue({})
  prepare.mockImplementation(async (f: File) => ({ file: f, reencoded: false, exifTakenAt: null }))
  mockOptions.mockReturnValue({ data: OPTIONS, isLoading: false })
})

describe('wizard — "At the house" step', () => {
  it('sits right after requirement, before documents and photos', async () => {
    renderWizard(onboarding())
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent)
    const i = (label: string) => steps.indexOf(label)
    expect(i(copy.steps.requirement)).toBeLessThan(i(copy.steps.house))
    expect(i(copy.steps.house)).toBeLessThan(i(copy.steps.documents))
    expect(i(copy.steps.house)).toBeLessThan(i(copy.steps.photos))
  })

  it('blocks Continue until the associate confirms; there is no skip', async () => {
    setMutateAsync.mockResolvedValue(resp(UNCONFIRMED))
    confirmMutateAsync.mockResolvedValue(resp(CONFIRMED))
    const user = userEvent.setup()
    renderWizard(onboarding())
    await goTo(user, HOUSE_CLICKS)
    expect(screen.getByTestId('photos-first-card')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.continueButton })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: m.actions.haveLink }))
    await user.click(screen.getByLabelText(m.paste.label))
    await user.paste('22.5726, 88.3639')
    await user.click(screen.getByRole('button', { name: m.actions.save }))
    expect(await screen.findByTestId('location-state')).toHaveAttribute('data-state', 'needsConfirm')
    expect(screen.getByRole('button', { name: copy.continueButton })).toBeDisabled() // set, but not confirmed

    await user.click(screen.getByRole('button', { name: m.actions.confirm }))
    await waitFor(() => expect(screen.getByRole('button', { name: copy.continueButton })).not.toBeDisabled())
    expect(screen.getByTestId('location-state')).toHaveAttribute('data-state', 'confirmedUnverified')

    await user.click(screen.getByRole('button', { name: copy.continueButton }))
    expect(screen.getByTestId('survey-layout')).toBeInTheDocument() // house → layout
  })

  it('changing a confirmed location resets confirmation and disables Continue again', async () => {
    setMutateAsync.mockResolvedValue(resp({ ...UNCONFIRMED, latitude: 22.6, longitude: 88.4 }))
    const user = userEvent.setup()
    renderWizard(onboarding({ site_location: CONFIRMED }))
    await goTo(user, HOUSE_CLICKS)
    expect(screen.getByRole('button', { name: copy.continueButton })).not.toBeDisabled()
    await user.click(screen.getByRole('button', { name: m.actions.change }))
    await user.click(screen.getByRole('button', { name: m.actions.haveLink }))
    await user.click(screen.getByLabelText(m.paste.label))
    await user.paste('22.6, 88.4')
    await user.click(screen.getByRole('button', { name: m.actions.save }))
    await waitFor(() => expect(screen.getByRole('button', { name: copy.continueButton })).toBeDisabled())
    expect(screen.getByText(m.details.resetNote)).toBeInTheDocument()
  })

  it('an edit deep link (from the to-do feed) opens on this step', () => {
    renderWizard(onboarding({ site_location: UNCONFIRMED }), { initialStep: 'house' })
    expect(screen.getAllByRole('heading', { name: m.title }).length).toBeGreaterThan(0)
  })

  it('embeds the first camera photo slot in this step; the other photos stay on the photos step', async () => {
    const user = userEvent.setup()
    renderWizard(onboarding({ site_location: CONFIRMED }), { initialStep: 'house' })
    const embedded = screen.getByTestId('house-photo-slot')
    // Known slots show the portal's own (translated) label, not the server's English one (FE-19).
    expect(embedded).toHaveTextContent(copy.photos.slotLabels.panel_installation_area)
    expect(screen.queryByRole('button', { name: m.actions.takePhoto })).not.toBeInTheDocument() // no jump-away button
    await user.click(screen.getByRole('button', { name: copy.continueButton })) // layout
    await user.click(screen.getByRole('button', { name: copy.continueButton })) // documents
    await user.click(screen.getByRole('button', { name: copy.continueButton })) // photos
    expect(screen.getByText('Front of premises')).toBeInTheDocument()
    expect(screen.queryByText(copy.photos.slotLabels.panel_installation_area)).not.toBeInTheDocument()
  })

  it('photo → "use this photo\'s location" → confirm → Continue, all on the house step', async () => {
    const geo = vi.fn((ok: PositionCallback) => ok({ coords: { latitude: 22.5726, longitude: 88.3639, accuracy: 9 } } as GeolocationPosition))
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: geo } })
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') })
    setMutateAsync.mockResolvedValue(resp(UNCONFIRMED))
    confirmMutateAsync.mockResolvedValue(resp(CONFIRMED))
    const user = userEvent.setup()
    const { container } = renderWizard(onboarding(), { initialStep: 'house' })
    const continueBtn = () => screen.getByRole('button', { name: copy.continueButton })

    // No photo yet: no one-tap option, Continue locked.
    expect(screen.queryByTestId('use-photo-location')).not.toBeInTheDocument()
    expect(continueBtn()).toBeDisabled()

    // Tap 1: take the photo (the slot's own camera input, same component and upload queue as the photos step).
    const camera = container.querySelector('[data-testid="house-photo-slot"] [data-testid="camera-input"]') as HTMLInputElement
    await user.upload(camera, new File(['x'], 'site.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledTimes(1))
    const upload = uploadMutateAsync.mock.calls[0][0]
    expect(upload.input).toMatchObject({ kind: 'photo', photo_slot: 'panel_installation_area', capture_method: 'camera', latitude: 22.5726, accuracy_m: 9 })

    // Tap 2: the one-tap prompt appears once the upload has succeeded, and sends photo_gps for that slot.
    const use = await screen.findByTestId('use-photo-location')
    expect(continueBtn()).toBeDisabled()
    await user.click(use)
    expect(setMutateAsync).toHaveBeenCalledWith({ id: 501, input: { source: 'photo_gps', photo_slot: 'panel_installation_area' } })
    expect(await screen.findByTestId('location-state')).toHaveAttribute('data-state', 'needsConfirm')
    expect(continueBtn()).toBeDisabled() // set is not confirmed

    // Tap 3: confirm. Continue unlocks only now.
    await user.click(screen.getByRole('button', { name: m.actions.confirm }))
    await waitFor(() => expect(continueBtn()).not.toBeDisabled())
    // Tap 4: Continue.
    await user.click(continueBtn())
    expect(screen.getByTestId('survey-layout')).toBeInTheDocument() // house → layout
    vi.unstubAllGlobals()
    // @ts-expect-error test override
    delete navigator.geolocation
  })

  it('a gallery photo in the house step never offers the one-tap prompt', async () => {
    const user = userEvent.setup()
    const { container } = renderWizard(onboarding(), { initialStep: 'house' })
    const gallery = container.querySelector('[data-testid="house-photo-slot"] [data-testid="gallery-input"]') as HTMLInputElement
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') })
    await user.upload(gallery, new File(['x'], 'g.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledTimes(1))
    expect(uploadMutateAsync.mock.calls[0][0].input.capture_method).toBe('gallery')
    expect(screen.queryByTestId('use-photo-location')).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})

describe('wizard — photos step', () => {
  async function toPhotos() {
    const user = userEvent.setup()
    renderWizard(onboarding({ site_location: CONFIRMED }))
    await goTo(user, HOUSE_CLICKS + 3) // → house → layout → documents → photos
    return user
  }

  it('repeats the priority card and shows the other photo slots', async () => {
    await toPhotos()
    expect(screen.getByTestId('photos-first-card')).toBeInTheDocument()
    expect(screen.getByText('Front of premises')).toBeInTheDocument()
  })

  it('"Take photo" is the filled primary button with a Recommended tag, and "Choose from phone" remains', async () => {
    await toPhotos()
    const take = screen.getByRole('button', { name: copy.photos.captureButton })
    expect(take.className).toContain('bg-[#0e2a63]')
    expect(screen.getByTestId('recommended-tag')).toHaveTextContent(en.photoSlot.recommendedTag)
    const choose = screen.getByRole('button', { name: en.photoSlot.galleryButton })
    expect(choose.className).not.toContain('bg-[#0e2a63]')
  })
})

describe('wizard — submit gate', () => {
  async function toReview(user: ReturnType<typeof userEvent.setup>) {
    await goTo(user, 11) // house confirmed in the fixture
  }

  it.each([
    ['missing_site_location', { missing_site_location: true, site_location_unconfirmed: false }, m.review.missing],
    ['site_location_unconfirmed', { missing_site_location: false, site_location_unconfirmed: true }, m.review.unconfirmed],
  ])('maps incomplete → %s to a message and a button that jumps to "At the house"', async (_n, flags, text) => {
    submitMutateAsync.mockRejectedValue(
      new ApiError(422, 'API error 422', 'Before submitting', { code: 'incomplete', message: 'Before submitting, …', missing_documents: ['electricity_bill'], ...flags })
    )
    const user = userEvent.setup()
    renderWizard(onboarding({ site_location: CONFIRMED }))
    await toReview(user)
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))
    const block = await screen.findByTestId('incomplete-location')
    expect(block).toHaveTextContent(text)
    expect(screen.getByText('Electricity bill')).toBeInTheDocument() // the documents list is still shown alongside
    await user.click(screen.getByRole('button', { name: m.review.goToStep }))
    expect(screen.getAllByRole('heading', { name: m.title }).length).toBeGreaterThan(0)
  })

  it('shows no location block when only documents are missing', async () => {
    submitMutateAsync.mockRejectedValue(
      new ApiError(422, 'API error 422', 'x', { code: 'incomplete', message: 'Before submitting', missing_documents: ['electricity_bill'], missing_site_location: false, site_location_unconfirmed: false })
    )
    const user = userEvent.setup()
    renderWizard(onboarding({ site_location: CONFIRMED }))
    await toReview(user)
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))
    await screen.findByText('Electricity bill')
    expect(screen.queryByTestId('incomplete-location')).not.toBeInTheDocument()
  })
})
