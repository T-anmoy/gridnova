// FE-20: the associate loose ends BE-20 closed (associate_journeys.md §9–11) and the minor items
// FE-19 listed — duplicate customer in three languages, names by code, the review summary, one
// "At the house" heading, counters that never read as an error, title-case place names.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { I18nProvider } from '@/lib/i18n/client'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Onboarding, OnboardingOptions } from '@/lib/associate/onboarding-types'
import { documentLabel, photoSlotsOf } from '@/lib/associate/onboarding-types'
import { labelFor, serverLabelsOf } from '@/lib/associate/execution-labels'
import { placeName } from '@/lib/associate/place-names'
import { ONBOARDING_OPTIONS, makeOnboarding } from './fixtures/survey-contract'
import { resetSurveyMocks } from './helpers/survey-mocks'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const m = vi.hoisted(() => ({ options: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingOptions: () => m.options(),
  useCreateOnboarding: () => ({ mutateAsync: vi.fn() }),
  useUpdateOnboarding: () => ({ mutateAsync: m.update }),
  useUploadOnboardingFile: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSubmitOnboarding: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, iso_code: 'WB', name: 'WEST BENGAL' }] }),
  useTerritoryDistricts: () => ({ data: [{ lgd_code: 340, name: 'PASCHIM BARDHAMAN', has_blocks: false }] }),
  useTerritoryBlocks: () => ({ data: [] }),
}))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))

const OPTIONS: OnboardingOptions = {
  ...ONBOARDING_OPTIONS,
  documents: [
    { key: 'electricity_bill', code: 'electricity_bill', label: 'Latest electricity bill', required_when: 'always' },
    { key: 'future_doc', code: 'future_doc', label: 'A document the copy has not met yet', required_when: 'always' },
  ],
  photo_slots: ['panel_installation_area', 'earthing_location'],
  photo_slot_items: [{ code: 'panel_installation_area', label: 'Panel installation area' }, { code: 'earthing_location', label: 'Earthing location' }],
}

const existing = (over: Partial<Onboarding> = {}): Onboarding =>
  makeOnboarding({
    onboarding_id: 701,
    site_location: { present: true, confirmed: true, latitude: 22.5, longitude: 88.3, source: 'device_gps', accuracy_m: 8, captured_at: '2026-01-01T00:00:00Z', verified: true, confirmed_at: '2026-01-01T00:00:00Z', confirmed_by: 'GNA-1', precision: null, flags: [], photo_distance_m: null, maps_url: null },
    ...over,
  })

const LOCALES = { en, hi, bn } as const
type Loc = keyof typeof LOCALES

async function renderWizard(loc: Loc, onboarding: Onboarding = existing()) {
  const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
  const msgs = LOCALES[loc] as typeof en
  return render(
    <I18nProvider locale={loc} messages={msgs}>
      <OnboardingWizard copy={msgs.associates.portal.wizard} territory={msgs.associates.territory} portalBase="/associates/portal" existing={onboarding} />
    </I18nProvider>,
  )
}

async function next(user: ReturnType<typeof userEvent.setup>, loc: Loc, times = 1) {
  const label = (LOCALES[loc] as typeof en).associates.portal.wizard.continueButton
  for (let i = 0; i < times; i++) await user.click(screen.getByRole('button', { name: label }))
}

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  window.localStorage.clear()
  m.options.mockReturnValue({ data: OPTIONS, isLoading: false })
  m.update.mockResolvedValue({})
})

describe('duplicate customer (409 duplicate_onboarding)', () => {
  it.each(['en', 'hi', 'bn'] as const)('%s: says it plainly and links to the existing record', async (loc) => {
    const copy = (LOCALES[loc] as typeof en).associates.portal.wizard
    m.update.mockRejectedValue(
      new ApiError(409, 'x', 'You have already onboarded this customer (same mobile). Update that record instead.', {
        code: 'duplicate_onboarding', field: 'customer_mobile', existing_onboarding_id: 31, client_code: 'GNE-WB-RES-2026-00031',
      }),
    )
    const user = userEvent.setup()
    await renderWizard(loc)
    await next(user, loc) // notice → customer
    const mobile = screen.getByLabelText(new RegExp(copy.customer.mobileLabel))
    await user.clear(mobile)
    await user.type(mobile, '9830012345')
    await next(user, loc)
    const box = await screen.findByTestId('duplicate-onboarding')
    expect(box).toHaveTextContent(copy.duplicate.title)
    const link = within(box).getByRole('link', { name: copy.duplicate.open.replace('{code}', 'GNE-WB-RES-2026-00031') })
    expect(link.getAttribute('href')).toBe(loc === 'en' ? '/associates/portal/customers/31' : `/${loc}/associates/portal/customers/31`)
    // The server's English sentence is never shown in Hindi or Bengali.
    if (loc !== 'en') expect(box).not.toHaveTextContent('already onboarded')
    expect(screen.queryByTestId('step-error')).toBeNull()
  })

  it('without a client code, the link still opens the record', async () => {
    m.update.mockRejectedValue(new ApiError(409, 'x', 'x', { code: 'duplicate_onboarding', existing_onboarding_id: 31 }))
    const user = userEvent.setup()
    await renderWizard('en')
    await next(user, 'en')
    const mobile = screen.getByLabelText(new RegExp(en.associates.portal.wizard.customer.mobileLabel))
    await user.clear(mobile)
    await user.type(mobile, '9830012345')
    await next(user, 'en')
    expect(await screen.findByRole('link', { name: en.associates.portal.wizard.duplicate.openNoCode })).toHaveAttribute('href', '/associates/portal/customers/31')
  })
})

describe('the wizard’s minor fixes', () => {
  it('"At the house" is one heading, not two', async () => {
    const user = userEvent.setup()
    await renderWizard('en')
    await next(user, 'en', 6) // notice → customer → connection → bills → property → requirement → house
    expect(screen.getAllByRole('heading', { name: en.associates.portal.wizard.steps.house })).toHaveLength(1)
  })

  it('the review step shows a read-only summary before Submit', async () => {
    const user = userEvent.setup()
    await renderWizard('en', existing({ customer_name: 'Ramesh Das' } as Partial<Onboarding>))
    await next(user, 'en', 11)
    const summary = screen.getByTestId('review-summary')
    const s = en.associates.portal.wizard.review.summary
    expect(summary).toHaveTextContent(s.title)
    expect(summary).toHaveTextContent(en.associates.portal.wizard.customer.nameLabel)
    expect(summary).toHaveTextContent(s.documents)
    expect(summary).toHaveTextContent(s.photos)
    expect(within(summary).queryByRole('textbox')).toBeNull()
    expect(within(summary).queryByRole('button')).toBeNull()
    expect(screen.getByRole('button', { name: en.associates.portal.wizard.review.submitButton })).toBeInTheDocument()
  })

  it.each(['hi', 'bn'] as const)('%s: the summary is translated', async (loc) => {
    const user = userEvent.setup()
    await renderWizard(loc)
    await next(user, loc, 11)
    expect(screen.getByTestId('review-summary')).toHaveTextContent((LOCALES[loc] as typeof en).associates.portal.wizard.review.summary.title)
  })

  it('documents and photo slots are named by code in the reader’s language', async () => {
    const user = userEvent.setup()
    await renderWizard('hi')
    await next(user, 'hi', 8) // … → layout → documents
    expect(screen.getByText(hi.associates.portal.wizard.documents.typeLabels.electricity_bill)).toBeInTheDocument()
    // A code the copy does not know yet falls back to the server's label, never the raw code.
    expect(screen.getByText('A document the copy has not met yet')).toBeInTheDocument()
    await next(user, 'hi')
    // (The first slot is taken on "At the house"; the rest are on the photos step.)
    expect(screen.getAllByText(hi.associates.portal.wizard.photos.slotLabels.earthing_location).length).toBeGreaterThan(0)
    expect(screen.queryByText('Earthing location')).toBeNull()
  })

  it('state and district names show in title case; the stored value is the LGD code', async () => {
    const user = userEvent.setup()
    await renderWizard('en')
    await next(user, 'en', 2)
    expect(screen.getByRole('option', { name: 'West Bengal' })).toHaveValue('19')
    expect(screen.queryByRole('option', { name: 'WEST BENGAL' })).toBeNull()
  })
})

describe('names by code, never by English text', () => {
  it('photoSlotsOf reads {code, label} items, translating by code', () => {
    const labels = en.associates.portal.wizard.photos.slotLabels
    expect(photoSlotsOf([{ code: 'earthing_location', label: 'Earthing location' }, { code: 'new_slot', label: 'Roof hatch' }], labels, 'Site photo')).toEqual([
      { key: 'earthing_location', label: labels.earthing_location },
      { key: 'new_slot', label: 'Roof hatch' },
    ])
    expect(photoSlotsOf(['wiring_path'], (bn as typeof en).associates.portal.wizard.photos.slotLabels, 'x')[0].label).toBe(bn.associates.portal.wizard.photos.slotLabels.wiring_path)
  })

  it('labelFor: the copy, then the server label, then a readable code', () => {
    const server = serverLabelsOf([{ code: 'dispatch_challan', label: 'Dispatch challan' }, { code: 'drone_survey', label: 'Drone survey' }])
    expect(labelFor(hi.associates.portal.execution.documents, 'dispatch_challan', server)).toBe(hi.associates.portal.execution.documents.dispatch_challan)
    expect(labelFor(hi.associates.portal.execution.documents, 'drone_survey', server)).toBe('Drone survey')
    expect(labelFor({}, 'thermal_scan')).toBe('Thermal scan')
  })

  it('documentLabel: by code, else the options label, else the code', () => {
    const labels = bn.associates.portal.wizard.documents.typeLabels
    expect(documentLabel('noc', labels)).toBe(labels.noc)
    expect(documentLabel('future_doc', labels, OPTIONS.documents)).toBe('A document the copy has not met yet')
    expect(documentLabel('mystery', labels)).toBe('mystery')
  })

  it('every site document and photo code in the contract has a name in en, hi and bn', () => {
    const docs = ['electricity_bill', 'id_proof', 'ownership_proof', 'subsidy_bank_details', 'photo', 'noc']
    const slots = ['panel_installation_area', 'acdb_dcdb_placement', 'earthing_location', 'inverter_installation_area', 'wiring_path', 'panel_to_inverter_distance', 'inverter_to_lt_panel_distance']
    for (const msgs of [en, hi, bn] as (typeof en)[]) {
      const w = msgs.associates.portal.wizard
      for (const d of docs) expect((w.documents.typeLabels as Record<string, string>)[d], d).toBeTruthy()
      for (const s of slots) expect((w.photos.slotLabels as Record<string, string>)[s], s).toBeTruthy()
      for (const seg of ['residential', 'commercial', 'industrial', 'government']) expect((msgs.associates.portal.estimate.fields.segments as Record<string, string>)[seg]).toBeTruthy()
    }
  })

  it('no source file looks a label up by its English text', async () => {
    const { readFileSync } = await import('node:fs')
    const files = ['components/associate/OnboardingWizard.tsx', 'components/associate/OnboardingDetail.tsx', 'components/execution/ExecutionEvidenceForm.tsx', 'components/dashboard/ExecutionDetailPanel.tsx']
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/\[\s*\w+\.label\s*\]|labelByLabel|byLabel\(|Map\([^)]*\.label\s*,/)
    }
  })
})

describe('counters read as progress, never as an error ("6 of 3 months")', () => {
  it.each([['en', en], ['hi', hi], ['bn', bn]] as const)('%s', (_l, msgs) => {
    const fill = (t: string, v: Record<string, number>) => Object.entries(v).reduce((acc, [k, n]) => acc.replace(`{${k}}`, String(n)), t)
    const bills = fill(msgs.survey.bills.recorded, { count: 6, min: 3 })
    const months = fill(msgs.survey.status.monthsRecorded, { recorded: 6, required: 3 })
    const docs = fill(msgs.associates.portal.checklist.counts, { uploaded: 6, needed: 4 })
    for (const t of [bills, months, docs]) expect(t).toMatch(/^6\D.*\(\D*[34]\D*\)$/)
    if (_l === 'en') expect([bills, months, docs]).toEqual(['6 months entered (3 needed)', '6 months entered (3 needed)', '6 uploaded (4 needed)'])
  })
})

describe('place names', () => {
  it.each([
    ['PASCHIM BARDHAMAN', 'Paschim Bardhaman'],
    ['WEST BENGAL', 'West Bengal'],
    ['NORTH 24 PARGANAS', 'North 24 Parganas'],
    ['COOCH-BEHAR', 'Cooch-Behar'],
    ['Kolkata', 'Kolkata'],
    ['', ''],
  ])('%s → %s', (raw, shown) => expect(placeName(raw)).toBe(shown))
})
