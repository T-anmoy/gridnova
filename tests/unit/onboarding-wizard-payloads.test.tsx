import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { ApiError } from '@/lib/dashboard/api-error'
import { validateWizardStep, type WizardDraft } from '@/lib/associate/wizard-validation'
import { EMPTY_SURVEY_FORM } from '@/lib/associate/survey'
import type { Onboarding, OnboardingOptions } from '@/lib/associate/onboarding-types'
import { ONBOARDING_OPTIONS, makeOnboarding } from './fixtures/survey-contract'
import { resetSurveyMocks } from './helpers/survey-mocks'
import { ONBOARDING_CREATE_BODY, ONBOARDING_PATCH_NAME } from './fixtures/onboarding-contract'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const createMutateAsync = vi.fn()
const updateMutateAsync = vi.fn()
const submitMutateAsync = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingOptions: () => ({ data: OPTIONS, isLoading: false }),
  useCreateOnboarding: () => ({ mutateAsync: createMutateAsync }),
  useUpdateOnboarding: () => ({ mutateAsync: updateMutateAsync }),
  useUploadOnboardingFile: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSubmitOnboarding: () => ({ mutateAsync: submitMutateAsync, isPending: false }),
  useSetSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, iso_code: 'WB', name: 'West Bengal' }] }),
  useTerritoryDistricts: () => ({ data: [{ lgd_code: 330, name: 'Kolkata', has_blocks: false }] }),
  useTerritoryBlocks: () => ({ data: [] }),
}))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))

const copy = en.associates.portal.wizard

// The house step blocks Continue until the site location is confirmed.
const CONFIRMED: Pick<Onboarding, 'site_location'> = {
  site_location: { present: true, confirmed: true, latitude: 22.5, longitude: 88.3, source: 'device_gps', accuracy_m: 8, captured_at: '2026-01-01T00:00:00Z', verified: true, confirmed_at: '2026-01-01T00:00:00Z', confirmed_by: 'GNA-1', precision: null, flags: [], photo_distance_m: null, maps_url: null },
}

const OPTIONS: OnboardingOptions = {
  ...ONBOARDING_OPTIONS,
  equipment_packages: [{ key: 'dcr', label: 'DCR package', equipment_tier: 'standard' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  createMutateAsync.mockResolvedValue(makeOnboarding({ onboarding_id: 901 }))
  updateMutateAsync.mockImplementation(async ({ id }: { id: number }) => makeOnboarding({ onboarding_id: id }))
  submitMutateAsync.mockResolvedValue({})
})

async function mountNew() {
  const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
  const user = userEvent.setup()
  render(withI18n(<OnboardingWizard copy={copy} territory={en.associates.territory} portalBase="/associates/portal" />))
  return user
}

const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: copy.continueButton }))

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(copy.customer.nameLabel), '  Asha Roy ')
  await user.type(screen.getByLabelText(copy.customer.mobileLabel), '9876543210')
  await user.selectOptions(screen.getByLabelText(copy.customer.customerTypeLabel), 'individual')
  await user.type(screen.getByLabelText(copy.customer.fullAddressLabel), '12 Park Street')
  await user.type(screen.getByLabelText(copy.customer.pinCodeLabel), '700016')
}

async function fillConnection(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(copy.connection.stateLabel), '19')
  await user.selectOptions(await screen.findByLabelText(copy.connection.districtLabel), '330')
  await user.selectOptions(screen.getByLabelText(copy.connection.connectionInCustomerNameLabel), 'yes')
  await user.selectOptions(screen.getByLabelText(copy.connection.siteTypeLabel), 'rooftop_residential')
  await user.selectOptions(screen.getByLabelText(copy.connection.connectionTypeLabel), 'on_grid')
}

describe('OnboardingWizard — a new customer, step by step', () => {
  it('blocks every step until its required fields are valid, and creates nothing before the requirement step', async () => {
    const user = await mountNew()

    // Notice: Continue stays disabled until the customer's agreement is ticked.
    expect(screen.getByRole('checkbox', { name: copy.notice.confirmLabel })).not.toBeChecked()
    expect(screen.getByRole('button', { name: copy.continueButton })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: copy.notice.confirmLabel }))
    await next(user)

    // Customer: empty form is refused with field errors; the wizard stays on the step.
    await next(user)
    expect(screen.getByText(copy.validation.fixErrors)).toBeInTheDocument()
    expect(screen.getByLabelText(copy.customer.nameLabel)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(copy.customer.nameLabel)).toBeInTheDocument()
    // A malformed mobile and PIN are caught on the device, before any request.
    await user.type(screen.getByLabelText(copy.customer.nameLabel), 'Asha Roy')
    await user.type(screen.getByLabelText(copy.customer.mobileLabel), '12345')
    await user.selectOptions(screen.getByLabelText(copy.customer.customerTypeLabel), 'individual')
    await user.type(screen.getByLabelText(copy.customer.fullAddressLabel), '12 Park Street')
    await user.type(screen.getByLabelText(copy.customer.pinCodeLabel), '70')
    await next(user)
    expect(screen.getByText(copy.validation.mobile)).toBeInTheDocument()
    expect(screen.getByText(copy.validation.pinCode)).toBeInTheDocument()

    expect(createMutateAsync).not.toHaveBeenCalled()
    expect(updateMutateAsync).not.toHaveBeenCalled()
  })

  it('walks notice → requirement with valid data and creates the customer with the exact body', async () => {
    const user = await mountNew()
    await user.click(screen.getByRole('checkbox', { name: copy.notice.confirmLabel }))
    await next(user)
    await fillCustomer(user)
    await next(user)
    await fillConnection(user)
    await next(user)
    // Bills: nothing entered is fine here (the server's checklist owns completeness).
    await next(user)
    await user.selectOptions(screen.getByLabelText(copy.property.propertyInCustomerNameLabel), 'no')
    await user.selectOptions(screen.getByLabelText(copy.property.customerTimelineLabel), 'within_3_months')
    await next(user)

    // Requirement: a package must be chosen before anything is created.
    await next(user)
    expect(createMutateAsync).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /DCR package/ }))
    await next(user)

    expect(createMutateAsync).toHaveBeenCalledTimes(1)
    expect(createMutateAsync).toHaveBeenCalledWith(ONBOARDING_CREATE_BODY)
    // The wizard moved on to the site-location step.
    expect(screen.getByText(`Step 7 of 12`)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2, name: copy.steps.house }).length).toBeGreaterThan(0)
  })
})

describe('OnboardingWizard — editing an existing customer', () => {
  async function mountExisting(over = {}) {
    const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
    const user = userEvent.setup()
    render(
      withI18n(
        <OnboardingWizard
          copy={copy}
          territory={en.associates.territory}
          portalBase="/associates/portal"
          existing={makeOnboarding({ onboarding_id: 777, customer: { name: 'Old Name', mobile: '9876543210', email: null }, ...over })}
        />
      )
    )
    await next(user) // notice -> customer details
    return user
  }

  it('PATCHes only the fields the step changed', async () => {
    const user = await mountExisting()
    const name = screen.getByLabelText(copy.customer.nameLabel)
    await user.clear(name)
    await user.type(name, 'New Name')
    await next(user)
    expect(updateMutateAsync).toHaveBeenCalledTimes(1)
    expect(updateMutateAsync.mock.calls[0][0]).toEqual({ id: 777, patch: ONBOARDING_PATCH_NAME })
    expect(createMutateAsync).not.toHaveBeenCalled()
  })

  it('sends no request at all when a step is left unchanged', async () => {
    const user = await mountExisting()
    await next(user)
    expect(updateMutateAsync).not.toHaveBeenCalled()
  })

  it('shows a save failure on the step and stays there', async () => {
    updateMutateAsync.mockRejectedValueOnce(new ApiError(500, 'API error 500', 'boom'))
    const user = await mountExisting()
    const name = screen.getByLabelText(copy.customer.nameLabel)
    await user.clear(name)
    await user.type(name, 'Another Name')
    await next(user)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText(copy.customer.nameLabel)).toHaveValue('Another Name')
  })
})

describe('OnboardingWizard — submit', () => {
  it('submits the onboarding id, then goes to that customer’s page', async () => {
    const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
    const user = userEvent.setup()
    render(
      withI18n(
        <OnboardingWizard
          copy={copy}
          territory={en.associates.territory}
          portalBase="/associates/portal"
          existing={makeOnboarding({ onboarding_id: 888, ...CONFIRMED })}
        />
      ),
    )
    for (let i = 0; i < 11; i++) await next(user) // notice -> … -> review
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))
    expect(submitMutateAsync).toHaveBeenCalledWith(888)
    expect(push).toHaveBeenCalledWith('/associates/portal/customers/888')
  })

  it('does not navigate when the backend refuses with an incomplete-submission error', async () => {
    submitMutateAsync.mockRejectedValueOnce(
      new ApiError(422, 'API error 422', 'incomplete', { code: 'incomplete', message: 'Upload every required document', missing_documents: ['electricity_bill'] }),
    )
    const { default: OnboardingWizard } = await import('@/components/associate/OnboardingWizard')
    const user = userEvent.setup()
    render(withI18n(<OnboardingWizard copy={copy} territory={en.associates.territory} portalBase="/associates/portal" existing={makeOnboarding({ onboarding_id: 889, ...CONFIRMED })} />))
    for (let i = 0; i < 11; i++) await next(user)
    await user.click(screen.getByRole('button', { name: copy.review.submitButton }))
    expect(await screen.findByText('Upload every required document')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('validateWizardStep — pure rules per step', () => {
  const draft = (over: Partial<WizardDraft> = {}): WizardDraft => ({
    customer_name: '', customer_mobile: '', customer_email: '', customer_type: '', pin_code: '', full_address: '',
    state_lgd_code: '', district_lgd_code: '', block_lgd_code: '', connection_in_customer_name: '', site_type: '', connection_type: '',
    property_in_customer_name: '', customer_timeline: '', equipment_package: '', notice_acknowledged: true,
    survey: EMPTY_SURVEY_FORM, ...over,
  })
  const ctx = {
    isNew: true,
    survey: ONBOARDING_OPTIONS.survey,
    v: copy.validation,
    s: { bills: en.survey.bills.errors, roof: en.survey.roof.errors, layout: en.survey.layout.errors },
  }

  it('customer: name, mobile, type, PIN and address are required; email only when filled', () => {
    expect(Object.keys(validateWizardStep('customer', draft(), ctx)).sort()).toEqual(['customer_mobile', 'customer_name', 'customer_type', 'full_address', 'pin_code'])
    expect(validateWizardStep('customer', draft({ customer_name: 'A', customer_mobile: '9876543210', customer_type: 'individual', pin_code: '700016', full_address: 'x', customer_email: 'nope' }), ctx)).toEqual({ customer_email: copy.validation.email })
  })

  it('connection: a state AND a district, plus the three choices', () => {
    expect(Object.keys(validateWizardStep('connection', draft(), ctx)).sort()).toEqual(['connection_in_customer_name', 'connection_type', 'district_lgd_code', 'site_type', 'state_lgd_code'])
  })

  it('property needs an answer; requirement needs a package only for a new customer', () => {
    expect(validateWizardStep('property', draft(), ctx)).toHaveProperty('property_in_customer_name')
    expect(validateWizardStep('requirement', draft(), ctx)).toHaveProperty('equipment_package')
    expect(validateWizardStep('requirement', draft(), { ...ctx, isNew: false })).toEqual({})
  })
})
