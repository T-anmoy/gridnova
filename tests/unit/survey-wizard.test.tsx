import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { ApiError } from '@/lib/dashboard/api-error'
import type { Onboarding } from '@/lib/associate/onboarding-types'
import { ONBOARDING_OPTIONS, SUBMIT_INCOMPLETE, SURVEY_RESULTS, SURVEY_STATUS_EMPTY, SURVEY_STATUS_SIGNED, makeOnboarding } from './fixtures/survey-contract'
import { resetSurveyMocks, surveyMocks } from './helpers/survey-mocks'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const createMutateAsync = vi.fn()
const updateMutateAsync = vi.fn()
const uploadMutateAsync = vi.fn()
const submitMutateAsync = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingOptions: () => ({ data: ONBOARDING_OPTIONS, isLoading: false }),
  useCreateOnboarding: () => ({ mutateAsync: createMutateAsync }),
  useUpdateOnboarding: () => ({ mutateAsync: updateMutateAsync }),
  useUploadOnboardingFile: () => ({ mutateAsync: uploadMutateAsync }),
  useSubmitOnboarding: () => ({ mutateAsync: submitMutateAsync, isPending: false }),
  useSetSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, iso_code: 'WB', name: 'West Bengal' }] }),
  useTerritoryDistricts: (code?: number) => ({ data: code ? [{ lgd_code: 340, name: 'Kolkata', has_blocks: false }] : undefined }),
  useTerritoryBlocks: () => ({ data: [] }),
}))
const prepare = vi.fn(async (f: File) => ({ file: f, reencoded: false, exifTakenAt: null }))
vi.mock('@/lib/associate/image-prep', async (orig) => ({ ...(await orig<typeof import('@/lib/associate/image-prep')>()), prepareImage: (f: File) => prepare(f) }))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))

import OnboardingWizard, { WIZARD_STEPS } from '@/components/associate/OnboardingWizard'

const copy = en.associates.portal.wizard
const s = en.survey
const CONFIRMED = { present: true, confirmed: true, latitude: 22.57, longitude: 88.36, source: 'device_gps' as const, accuracy_m: 8, verified: true, flags: [], maps_url: 'https://www.google.com/maps?q=22.57,88.36' }

const continueBtn = () => screen.getByRole('button', { name: new RegExp(`^${copy.continueButton}|${copy.saving}`) })
async function clickContinue(user: ReturnType<typeof userEvent.setup>, times = 1) {
  for (let i = 0; i < times; i++) await user.click(screen.getByRole('button', { name: copy.continueButton }))
}
function renderWizard(existing?: Onboarding, extra: Partial<React.ComponentProps<typeof OnboardingWizard>> = {}) {
  return render(withI18n(<OnboardingWizard copy={copy} territory={en.associates.territory} portalBase="/associates/portal" existing={existing} {...extra} />))
}
const stepIndex = (k: string) => WIZARD_STEPS.indexOf(k as (typeof WIZARD_STEPS)[number])

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  updateMutateAsync.mockImplementation(async () => makeOnboarding({ site_location: CONFIRMED }))
  uploadMutateAsync.mockResolvedValue({})
})

describe('step order and the survey gate', () => {
  it('bills after connection, layout after the house, survey just before review', () => {
    expect(WIZARD_STEPS).toEqual(['notice', 'customer', 'connection', 'bills', 'property', 'requirement', 'house', 'layout', 'documents', 'photos', 'survey', 'review'])
    renderWizard(makeOnboarding({ site_location: CONFIRMED }))
    const items = within(screen.getByTestId('wizard-steps')).getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    expect(items.map((li) => li.textContent)).toContain(copy.steps.survey)
  })

  it('the roof survey stays locked until the house location is confirmed', () => {
    renderWizard(makeOnboarding(), { initialStep: 'house' })
    expect(screen.getByTestId('roof-locked')).toHaveTextContent(s.roof.lockedUntilLocation)
    expect(screen.queryByTestId('survey-roof')).not.toBeInTheDocument()
  })
})

describe('new customer: flat create body, validation, one create on a double tap', () => {
  async function fillToRequirement(user: ReturnType<typeof userEvent.setup>) {
    renderWizard()
    await user.click(screen.getByRole('checkbox'))
    await clickContinue(user)
    // Labels are tied to their inputs (getByLabelText).
    await user.type(screen.getByLabelText(copy.customer.nameLabel), 'Asha Roy')
    await user.type(screen.getByLabelText(copy.customer.mobileLabel), '9800000001')
    await user.selectOptions(screen.getByLabelText(copy.customer.customerTypeLabel), 'individual')
    await user.type(screen.getByLabelText(copy.customer.fullAddressLabel), '12 Park Street')
    await user.type(screen.getByLabelText(copy.customer.pinCodeLabel), '700001')
    await clickContinue(user)
    await user.selectOptions(screen.getByLabelText(copy.connection.connectionInCustomerNameLabel), 'yes')
    await user.selectOptions(screen.getByLabelText(copy.connection.siteTypeLabel), 'rooftop_residential')
    await user.selectOptions(screen.getByLabelText(copy.connection.connectionTypeLabel), 'on_grid')
    await user.selectOptions(screen.getByLabelText(s.connection.discomLabel), 'CESC')
    await clickContinue(user)
    // Bills: the requested months are pre-filled as prompts.
    expect(screen.getAllByTestId(/^bill-row-/)).toHaveLength(ONBOARDING_OPTIONS.survey.requested_consumption_months)
    const firstRow = screen.getByTestId('bill-row-0')
    await user.type(within(firstRow).getByLabelText(s.bills.unitsLabel), '400')
    await clickContinue(user)
    await user.selectOptions(screen.getByLabelText(copy.property.propertyInCustomerNameLabel), 'no')
    await clickContinue(user)
    await user.click(screen.getByRole('button', { name: /DCR package/ }))
  }

  it('blocks Continue with inline, linked errors and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('checkbox'))
    await clickContinue(user)
    await user.type(screen.getByLabelText(copy.customer.mobileLabel), '12345')
    await clickContinue(user)
    const name = screen.getByLabelText(copy.customer.nameLabel)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(name.getAttribute('aria-describedby')!.split(' ').pop()!)).toHaveTextContent(copy.validation.required)
    expect(screen.getByLabelText(copy.customer.mobileLabel)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(copy.validation.mobile)).toBeInTheDocument()
    await waitFor(() => expect(name).toHaveFocus())
    expect(screen.getByTestId('step-error')).toHaveTextContent(copy.validation.fixErrors)
  })

  it('creates once with the flat contract body (required fields + survey answers), even on a double tap', async () => {
    let resolve!: (o: unknown) => void
    createMutateAsync.mockImplementation(() => new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    await fillToRequirement(user)
    const btn = screen.getByRole('button', { name: copy.continueButton })
    fireEvent.click(btn)
    fireEvent.click(btn)
    await waitFor(() => expect(continueBtn()).toBeDisabled())
    expect(continueBtn()).toHaveTextContent(copy.saving)
    expect(createMutateAsync).toHaveBeenCalledTimes(1)
    const body = createMutateAsync.mock.calls[0][0]
    expect(body).toMatchObject({
      notice_version: 'v1',
      notice_acknowledged: true,
      customer_name: 'Asha Roy',
      customer_mobile: '9800000001',
      customer_type: 'individual',
      project_family: 'rooftop_solar',
      pin_code: '700001',
      full_address: '12 Park Street',
      site_type: 'rooftop_residential',
      connection_type: 'on_grid',
      state_lgd_code: 19,
      district_lgd_code: 340,
      connection_in_customer_name: true,
      property_in_customer_name: false,
      equipment_package: 'dcr',
      discom: 'CESC',
      consumption_history: [{ month: expect.stringMatching(/^\d{4}-\d{2}$/), units_kwh: 400 }],
    })
    expect(body).not.toHaveProperty('customer')
    expect(body).not.toHaveProperty('territory')
    expect(body).not.toHaveProperty('shadow_free_area_sqft')
    resolve({ ...makeOnboarding({ onboarding_id: 777 }), warnings: [] })
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 2, name: copy.steps.house }).length).toBeGreaterThan(0))
  })

  it('a create 422 on a bill month jumps back to the bills step and marks that row', async () => {
    createMutateAsync.mockRejectedValue(new ApiError(422, 'x', 'Month in the future', { code: 'future_month', field: 'consumption_history', index: 0 }))
    const user = userEvent.setup()
    await fillToRequirement(user)
    await clickContinue(user)
    expect(await screen.findByTestId('survey-bills')).toBeInTheDocument()
    expect(within(screen.getByTestId('bill-row-0')).getByText(s.bills.errors.future_month)).toBeInTheDocument()
  })
})

describe('bills step', () => {
  it('maps each row problem to its row, translated', async () => {
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }))
    await clickContinue(user, stepIndex('bills'))
    const row1 = screen.getByTestId('bill-row-1')
    await user.type(within(row1).getByLabelText(s.bills.billLabel), '900')
    await clickContinue(user)
    expect(within(screen.getByTestId('bill-row-1')).getByText(s.bills.errors.units_required)).toBeInTheDocument()
    expect(updateMutateAsync).not.toHaveBeenCalled()
  })

  it('shows the server-derived averages, never computing them', async () => {
    surveyMocks.results.mockReturnValue({ data: SURVEY_RESULTS, isLoading: false, error: null, refetch: vi.fn() })
    renderWizard(makeOnboarding({ site_location: CONFIRMED }))
    const user = userEvent.setup()
    await clickContinue(user, stepIndex('bills'))
    const box = screen.getByTestId('bill-averages')
    expect(box).toHaveTextContent('400 kWh')
    expect(box).toHaveTextContent('₹3,200.00')
    expect(box).toHaveTextContent('₹8.00 per unit')
  })
})

describe('house step: roof survey', () => {
  async function toHouse(over: Partial<Onboarding> = {}) {
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED, ...over }), { initialStep: 'house' })
    return user
  }

  it('asks for the tenant NOC only when the roof is not owned', async () => {
    const user = await toHouse()
    expect(screen.queryByLabelText(s.roof.tenantNocLabel)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(s.roof.ownershipLabel), 'no')
    expect(screen.getByLabelText(s.roof.tenantNocLabel)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(s.roof.ownershipLabel), 'yes')
    expect(screen.queryByLabelText(s.roof.tenantNocLabel)).not.toBeInTheDocument()
  })

  it('"None" sends [] for obstacles; sections are sent and the shade-free area never is', async () => {
    const user = await toHouse()
    await user.click(screen.getByRole('checkbox', { name: s.roof.obstaclesNone }))
    await user.click(screen.getByRole('button', { name: s.roof.addSection }))
    const sec = screen.getByTestId('roof-section-0')
    await user.type(within(sec).getByLabelText(s.roof.sectionLabel), 'Main')
    await user.type(within(sec).getByLabelText(s.roof.lengthLabel), '10')
    await user.type(within(sec).getByLabelText(s.roof.widthLabel), '8')
    expect(screen.getByTestId('derived-shadow-free')).toHaveTextContent(s.roof.derivedPending)
    await clickContinue(user)
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1))
    const patch = updateMutateAsync.mock.calls[0][0].patch
    expect(patch.roof_obstacles).toEqual([])
    expect(patch.roof_sections).toEqual([{ label: 'Main', length_m: 10, width_m: 8, obstacle_area_sqm: null }])
    expect(patch).not.toHaveProperty('shadow_free_area_sqft')
  })

  it('shows the server-derived shade-free area once the stored sections match', async () => {
    await toHouse({ site_assessment: { ...makeOnboarding().site_assessment!, roof_sections: [{ label: 'Main', length_m: '10.00', width_m: '8.00', obstacle_area_sqm: null }], shadow_free_area_sqft: 861.1 } })
    expect(screen.getByTestId('derived-shadow-free')).toHaveTextContent('861.1 sq ft')
  })

  it('switching stored sections to a typed area sends two PATCHes, sections cleared first (never 422 derived_field)', async () => {
    const user = await toHouse({ site_assessment: { ...makeOnboarding().site_assessment!, roof_sections: [{ label: 'Main', length_m: '10.00', width_m: '8.00' }], shadow_free_area_sqft: 861.1 } })
    await user.click(screen.getByRole('radio', { name: s.roof.modeDirect }))
    await user.type(screen.getByLabelText(s.roof.shadowFreeLabel), '700')
    await clickContinue(user)
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(2))
    expect(updateMutateAsync.mock.calls[0][0].patch).toEqual({ roof_sections: [] })
    expect(updateMutateAsync.mock.calls[1][0].patch).toEqual({ shadow_free_area_sqft: 700 })
  })

  it('a server derived_field 422 lands on the shade-free field, translated', async () => {
    updateMutateAsync.mockRejectedValue(new ApiError(422, 'x', 'derived', { code: 'derived_field', field: 'shadow_free_area_sqft' }))
    const user = await toHouse()
    await user.click(screen.getByRole('radio', { name: s.roof.modeDirect }))
    await user.type(screen.getByLabelText(s.roof.shadowFreeLabel), '700')
    await clickContinue(user)
    expect(await screen.findByText(s.roof.errors.derived_field)).toBeInTheDocument()
    expect(screen.getByLabelText(s.roof.shadowFreeLabel)).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('layout step', () => {
  it('refuses a distance above distance_max_m before saving, and maps the server out_of_range', async () => {
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }), { initialStep: 'house' })
    await clickContinue(user) // → layout
    await user.type(screen.getByLabelText(s.layout.panelToInverterLabel), '301')
    await clickContinue(user)
    expect(screen.getByText('This distance is above 300 m.')).toBeInTheDocument()
    expect(updateMutateAsync).not.toHaveBeenCalled()

    updateMutateAsync.mockRejectedValueOnce(new ApiError(422, 'x', 'too far', { code: 'out_of_range', field: 'distance_inverter_to_lt_panel_m', max_m: 250 }))
    await user.clear(screen.getByLabelText(s.layout.panelToInverterLabel))
    await user.type(screen.getByLabelText(s.layout.inverterToLtLabel), '260')
    await clickContinue(user)
    expect(await screen.findByText('This distance is above 250 m.')).toBeInTheDocument()
  })
})

describe('re-sign notice', () => {
  it('when an edit clears both signatures, the associate is told the customer must sign again', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_SIGNED, isLoading: false, error: null, refetch: vi.fn() })
    surveyMocks.refresh.mockResolvedValue({ ...SURVEY_STATUS_SIGNED, signatures: SURVEY_STATUS_EMPTY.signatures })
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }), { initialStep: 'house' })
    expect(screen.getByText(s.signatures.resignWarning)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(s.roof.materialLabel), 'tin_shed')
    await clickContinue(user)
    expect(await screen.findByTestId('resign-notice')).toHaveTextContent(s.signatures.resignNotice)
  })

  it('no notice when nothing was signed before', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    surveyMocks.refresh.mockResolvedValue(SURVEY_STATUS_EMPTY)
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }), { initialStep: 'house' })
    await user.selectOptions(screen.getByLabelText(s.roof.materialLabel), 'tin_shed')
    await clickContinue(user)
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled())
    expect(screen.queryByTestId('resign-notice')).not.toBeInTheDocument()
  })
})

describe('survey step', () => {
  async function toSurvey() {
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }), { initialStep: 'survey' })
    return user
  }

  it('lists sections with deep links that land on the right step', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    const user = await toSurvey()
    const roof = screen.getByTestId('survey-section-roof')
    expect(roof).toHaveTextContent(s.status.missing)
    expect(roof).toHaveTextContent('Roof access')
    await user.click(within(screen.getByTestId('survey-section-layout')).getByRole('button'))
    expect(screen.getByTestId('survey-layout')).toBeInTheDocument()
  })

  it('shows the suggested size, translated warnings and the indicative Nova estimate', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    surveyMocks.results.mockReturnValue({
      data: { ...SURVEY_RESULTS, warnings: [{ code: 'overhead_line' }, { code: 'requested_above_suggested', params: { requested_kw: 5, suggested_kw: 3, limiting_factor: 'usage' } }] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    await toSurvey()
    expect(screen.getByTestId('suggested-kw')).toHaveTextContent('3 kW')
    expect(screen.getByTestId('survey-warning-overhead_line')).toHaveTextContent(s.warnings.overhead_line)
    expect(screen.getByTestId('survey-warning-requested_above_suggested')).toHaveTextContent('limited by electricity use')
    expect(screen.queryByText('overhead_line')).not.toBeInTheDocument()
    const est = screen.getByTestId('survey-estimate')
    expect(est).toHaveTextContent('Nova Assured')
    expect(est).toHaveTextContent('Nova Signature')
    expect(est).toHaveTextContent('₹1,96,200.00')
    expect(est).toHaveTextContent(s.results.indicativeNote)
    expect(est).toHaveTextContent(en.pricing.subsidy.conditions.dcr_modules_required)
  })

  it('custom quote and not-enough-to-size are shown honestly', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    surveyMocks.results.mockReturnValue({
      data: { ...SURVEY_RESULTS, estimate: { ...SURVEY_RESULTS.estimate!, price_status: 'custom_quote', custom_quote_reasons: ['size_above_max'], packages: {} } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    await toSurvey()
    expect(screen.getByTestId('survey-estimate')).toHaveTextContent(en.pricing.customQuote.reasons.size_above_max)
    expect(screen.getByTestId('survey-estimate')).not.toHaveTextContent('₹')
  })

  it('not enough to size: no kW, plain message', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    surveyMocks.results.mockReturnValue({
      data: { ...SURVEY_RESULTS, suggested_kw: null, limiting_factor: null, estimate: { ...SURVEY_RESULTS.estimate!, price_status: 'not_enough_to_size', size_kw: null, packages: {} } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    await toSurvey()
    expect(screen.getByTestId('survey-not-enough')).toHaveTextContent(s.results.notEnough)
    expect(screen.getByTestId('survey-estimate')).toHaveTextContent(s.results.notEnoughToPrice)
  })

  it('grandfathered: no survey gate', async () => {
    surveyMocks.status.mockReturnValue({ data: { ...SURVEY_STATUS_EMPTY, grandfathered: true }, isLoading: false, error: null, refetch: vi.fn() })
    await toSurvey()
    expect(screen.getByTestId('survey-not-required')).toHaveTextContent(s.status.notRequired)
  })

  it('customer signature: refuses a missing name, a missing tick and an empty pad without uploading', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    const user = await toSurvey()
    await user.click(screen.getByRole('button', { name: s.signatures.signCustomer }))
    const block = screen.getByTestId('signature-customer')
    expect(within(block).getByText(s.signatures.errors.declaration_name_required)).toBeInTheDocument()
    expect(within(block).getByText(s.signatures.errors.confirmation_required)).toBeInTheDocument()
    expect(within(block).getByText(s.signatures.emptyPad)).toBeInTheDocument()
    expect(surveyMocks.sign).not.toHaveBeenCalled()
  })

  it('offline: an honest "connect to save signatures" state, nothing queued', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await toSurvey()
    expect(screen.getByTestId('signatures-offline')).toHaveTextContent(s.signatures.offline)
    spy.mockRestore()
  })

  it('shows who signed and when (IST) once both are signed', async () => {
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_SIGNED, isLoading: false, error: null, refetch: vi.fn() })
    await toSurvey()
    expect(screen.getByTestId('signed-customer')).toHaveTextContent('Signed by Asha Roy · 12 Oct 2026')
    expect(screen.queryByRole('button', { name: s.signatures.signCustomer })).not.toBeInTheDocument()
  })
})

describe('review / submit', () => {
  it('turns the §6 422 into section deep links and a signatures link', async () => {
    submitMutateAsync.mockRejectedValue(new ApiError(422, 'x', SUBMIT_INCOMPLETE.message, { ...SUBMIT_INCOMPLETE }))
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }), { initialStep: 'survey' })
    await clickContinue(user) // → review
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))
    const survey = await screen.findByTestId('incomplete-survey')
    expect(within(survey).getByRole('button', { name: `Go to ${s.status.sections.bills}` })).toBeInTheDocument()
    expect(screen.getByTestId('incomplete-signatures')).toHaveTextContent(s.review.parties.associate)
    await user.click(within(survey).getByRole('button', { name: `Go to ${s.status.sections.layout}` }))
    expect(screen.getByTestId('survey-layout')).toBeInTheDocument()
  })

  it('the signatures link opens the survey step', async () => {
    submitMutateAsync.mockRejectedValue(new ApiError(422, 'x', SUBMIT_INCOMPLETE.message, { ...SUBMIT_INCOMPLETE }))
    surveyMocks.status.mockReturnValue({ data: SURVEY_STATUS_EMPTY, isLoading: false, error: null, refetch: vi.fn() })
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }), { initialStep: 'survey' })
    await clickContinue(user)
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))
    await user.click(await screen.findByRole('button', { name: s.review.goToSignatures }))
    expect(screen.getByTestId('survey-step')).toBeInTheDocument()
  })

  it('a successful submit clears the draft and opens the customer', async () => {
    submitMutateAsync.mockResolvedValue({})
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ onboarding_id: 812, site_location: CONFIRMED }), { initialStep: 'survey' })
    await clickContinue(user)
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/associates/portal/customers/812'))
    expect(window.localStorage.getItem('gna-onboarding-user_1-812')).toBeNull()
  })
})

describe('documents step remembers what the server has', () => {
  it('a resumed draft shows an uploaded document as uploaded, not missing', async () => {
    const user = userEvent.setup()
    renderWizard(
      makeOnboarding({
        site_location: CONFIRMED,
        documents: [{ document_type: 'electricity_bill', file_ref: 'f1', filename: 'bill-july.pdf', received_at: '2026-10-01T00:00:00Z', latitude: null, longitude: null, client_captured_at: null }],
      }),
      { initialStep: 'house' }
    )
    await clickContinue(user, 2) // → layout → documents
    expect(screen.getByTestId('file-already-uploaded')).toHaveTextContent('Already uploaded: bill-july.pdf')
  })
})

describe('H3 — step changes, pending photos, start over', () => {
  it('moves focus to the new step heading and marks the current step', async () => {
    const user = userEvent.setup()
    renderWizard(makeOnboarding({ site_location: CONFIRMED }))
    await clickContinue(user)
    const heading = screen.getByRole('heading', { level: 2, name: copy.steps.customer })
    expect(heading).toHaveFocus()
    expect(within(screen.getByTestId('wizard-steps')).getByText(copy.steps.customer)).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Step 2 of 12')).toBeInTheDocument()
  })

  it('blocks submit while a photo is still uploading, and says why', async () => {
    uploadMutateAsync.mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('URL', Object.assign(function () {}, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }))
    const user = userEvent.setup()
    const { container } = renderWizard(makeOnboarding({ site_location: CONFIRMED }), { initialStep: 'house' })
    await clickContinue(user, 3) // → layout → documents → photos
    const gallery = container.querySelector('[data-testid="gallery-input"]') as HTMLInputElement
    await user.upload(gallery, new File(['x'], 'front.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalled())
    await clickContinue(user, 2) // → survey → review
    expect(screen.getByTestId('photos-pending')).toHaveTextContent('1 photo(s) are still uploading')
    expect(screen.getByRole('button', { name: copy.review.submitButton })).toBeDisabled()
    expect(submitMutateAsync).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('"Start over" clears the stored draft after a confirmation', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('checkbox'))
    await clickContinue(user)
    await user.type(screen.getByLabelText(copy.customer.nameLabel), 'Asha Roy')
    await waitFor(() => expect(window.localStorage.getItem('gna-onboarding-user_1-new')).toContain('Asha Roy'))
    await user.click(screen.getByRole('button', { name: copy.startOver }))
    await user.click(screen.getByRole('button', { name: copy.startOverYes }))
    expect(screen.getByRole('heading', { level: 2, name: copy.steps.notice })).toBeInTheDocument()
    await waitFor(() => expect(window.localStorage.getItem('gna-onboarding-user_1-new') ?? '').not.toContain('Asha Roy'))
  })

  it("one signed-in user's new-customer draft never opens for another", async () => {
    writeDraftFor('gna-onboarding-user_1-new', 'Asha Roy')
    surveyMocks.userId = 'user_2'
    renderWizard()
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await clickContinue(user)
    expect(screen.getByLabelText(copy.customer.nameLabel)).toHaveValue('')
  })
})

function writeDraftFor(key: string, name: string) {
  window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: { customer_name: name, notice_acknowledged: true } }))
}
