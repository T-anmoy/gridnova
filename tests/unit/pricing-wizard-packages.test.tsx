import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { CATALOGUE } from './fixtures/pricing'
import type { Onboarding, OnboardingOptions } from '@/lib/associate/onboarding-types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
const mockOptions = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingOptions: () => mockOptions(),
  useCreateOnboarding: () => ({ mutateAsync: vi.fn() }),
  useUpdateOnboarding: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useUploadOnboardingFile: () => ({ mutateAsync: vi.fn() }),
  useSubmitOnboarding: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, iso_code: 'WB', name: 'West Bengal' }] }),
  useTerritoryDistricts: () => ({ data: [] }),
  useTerritoryBlocks: () => ({ data: [] }),
}))

import OnboardingWizard from '@/components/associate/OnboardingWizard'

const copy = en.associates.portal.wizard
const OPTIONS = {
  notice: { version: 'v1', text: 'Notice' },
  equipment_packages: [
    { key: 'nova_assured', label: 'Nova Assured', equipment_tier: 'standard' },
    { key: 'nova_signature', label: 'Nova Signature', equipment_tier: 'premium' },
  ],
  documents: [],
  photo_slots: [],
  customer_timelines: ['immediate'],
  attribution_lock_days: 7,
  site_location: { accuracy_good_m: 20, accuracy_warn_m: 50, accuracy_reject_m: 200, sample_seconds: 10, required_to_submit: true, sources: [], recommended_source: 'photo_gps' },
} as unknown as OnboardingOptions

const existing = {
  onboarding_id: 1,
  status: 'draft',
  customer: { name: 'A', mobile: '9', email: null },
  territory: { state: { lgd_code: 19, name: 'WB' }, district: null, block: null },
  site_location: { present: false, confirmed: false },
  connection_in_customer_name: true,
  property_in_customer_name: true,
  customer_timeline: 'immediate',
  photos: [],
  warnings: [],
  can_edit: true,
} as unknown as Onboarding

beforeEach(() => {
  window.localStorage.clear()
  mockOptions.mockReturnValue({ data: OPTIONS, isLoading: false })
})
afterEach(() => vi.unstubAllGlobals())

async function toPackages() {
  const user = userEvent.setup()
  render(withI18n(<OnboardingWizard copy={copy} territory={en.associates.territory} portalBase="/associates/portal" existing={existing} />))
  for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: copy.continueButton }))
  return user
}

describe('wizard package step — real makes, equal cards', () => {
  it('shows both packages, always visible and equal, with the makes and technology from the catalogue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(CATALOGUE), { status: 200 })))
    await toPackages()
    const buttons = [screen.getByRole('button', { name: /Nova Assured/ }), screen.getByRole('button', { name: /Nova Signature/ })]
    expect(buttons[0].className).toBe(buttons[1].className)
    await waitFor(() => expect(buttons[0]).toHaveTextContent('Test Panel Co A, Test Panel Co B'))
    expect(buttons[1]).toHaveTextContent('Test Panel Co C')
    expect(buttons[1]).toHaveTextContent('Test technology two, Test technology three')
    expect(buttons[0]).toHaveTextContent(/or equivalent/i)
    // One plain sentence about "or equivalent".
    expect(screen.getByText(en.pricing.packages.orEquivalentNote)).toBeInTheDocument()
    // No price is shown: the wizard knows neither size nor phase.
    expect(document.body.textContent).not.toMatch(/₹/)
  })

  it('still selects a package, and still works if the catalogue cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    const user = await toPackages()
    expect(screen.getAllByRole('button', { name: /Nova (Assured|Signature)/ })).toHaveLength(2)
    expect(screen.queryByTestId('package-equipment')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Nova Signature/ }))
    expect(within(screen.getByRole('button', { name: /Nova Signature/ })).getByText('Nova Signature')).toBeInTheDocument()
  })
})
