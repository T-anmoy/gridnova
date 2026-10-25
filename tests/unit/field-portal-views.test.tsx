import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { en, withI18n } from './helpers/i18n'
import { makeOnboarding, SURVEY_RESULTS, SURVEY_STATUS_EMPTY } from './fixtures/survey-contract'
import { resetSurveyMocks, surveyMocks } from './helpers/survey-mocks'
import type { Onboarding } from '@/lib/associate/onboarding-types'

vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
vi.mock('@/lib/associate/api-client', () => ({
  useTerritoryStates: () => ({ data: [{ lgd_code: 19, iso_code: 'WB', name: 'West Bengal' }] }),
  useTerritoryDistricts: (code?: number) => ({ data: code ? [{ lgd_code: 340, name: 'Kolkata', has_blocks: false }] : undefined }),
  useTerritoryBlocks: () => ({ data: [] }),
  useKycConsent: () => ({ data: undefined }),
  useSeatAvailability: () => ({ data: undefined, isFetching: false }),
  submitApplication: vi.fn(),
  useAssociateMe: () => me(),
}))
const me = vi.fn()
const agreementQuery = vi.fn()
const onboardingQuery = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboarding: () => onboardingQuery(),
  useOnboardingProgress: () => ({ data: undefined }),
  useRequestFormalProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingFormalProposal: () => ({ data: { prepared: false, missing_fields: [] }, isLoading: false }),
  useInPersonAcceptance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingAgreement: () => agreementQuery(),
  useUploadSignedAgreement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingEstimates: () => ({ data: [], isLoading: false }),
  useCreateEstimate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('@/lib/pricing/usePackageCatalogue', () => ({ usePackageCatalogue: () => ({ catalogue: null }) }))

import AssociateApplyForm from '@/components/associate/AssociateApplyForm'
import OnboardingDetail from '@/components/associate/OnboardingDetail'
import { fillDateField } from './helpers/date-field'

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  window.localStorage.clear()
  agreementQuery.mockReturnValue({ data: { links: { agreement_pdf: null } }, isLoading: false })
})

describe('H12 — apply form labels and identifier inputs', () => {
  it('every field is reachable by its label; phone, PIN, Aadhaar and bank fields get the right keyboard', () => {
    render(<AssociateApplyForm kind="associate" t={en.associates} />)
    const f = en.associates.wizard.fields
    const name = screen.getByLabelText(f.full_name.label)
    const mobile = screen.getByLabelText(f.mobile.label)
    expect(mobile).toHaveAttribute('inputmode', 'tel')
    expect(mobile).toHaveAttribute('maxlength', '14')
    expect(screen.getByLabelText(f.email.label)).toHaveAttribute('autocapitalize', 'none')
    expect(name.className).toContain('text-base')
    expect(name.className).toContain('min-h-[44px]')
    fireEvent.change(name, { target: { value: 'Asha Roy' } })
    fillDateField(f.date_of_birth.label, '1990-01-01')
    fireEvent.change(mobile, { target: { value: '9876543210' } })
    fireEvent.change(screen.getByLabelText(f.email.label), { target: { value: 'asha@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: en.associates.wizard.common.next }))

    expect(screen.getByLabelText(f.pin_code.label)).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(screen.getByLabelText(f.address_line.label), { target: { value: '12 Park Street' } })
    fireEvent.change(screen.getByLabelText(f.pin_code.label), { target: { value: '700001' } })
    fireEvent.click(screen.getByRole('button', { name: en.associates.wizard.common.next }))

    const aadhaar = screen.getByLabelText(f.aadhaar_number.label)
    expect(aadhaar).toHaveAttribute('inputmode', 'numeric')
    expect(aadhaar).toHaveAttribute('autocomplete', 'off')
    const pan = screen.getByLabelText(f.pan.label)
    expect(pan).toHaveAttribute('autocapitalize', 'characters')
    expect(pan).toHaveAttribute('spellcheck', 'false')
    expect(screen.getByLabelText(f.bank_account_number.label)).toHaveAttribute('autocomplete', 'off')
    const ifsc = screen.getByLabelText(f.bank_ifsc.label)
    expect(ifsc).toHaveAttribute('autocapitalize', 'characters')
    expect(ifsc).toHaveAttribute('autocomplete', 'off')

    // The draft never carries what was typed into identity fields.
    fireEvent.change(aadhaar, { target: { value: '123412341234' } })
    expect(window.localStorage.getItem('gna-apply-associate-user_1') ?? '').not.toContain('123412341234')
    expect(window.localStorage.getItem('gna-apply-associate-user_1') ?? '').not.toContain('9876543210')
  })

  it('an invalid field is marked and described by its error', () => {
    render(<AssociateApplyForm kind="associate" t={en.associates} />)
    fireEvent.click(screen.getByRole('button', { name: en.associates.wizard.common.next }))
    const name = screen.getByLabelText(en.associates.wizard.fields.full_name.label)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name.getAttribute('aria-describedby')).toMatch(/-error/)
  })
})

describe('Phase 3 — customer detail survey card', () => {
  function renderDetail(o: Onboarding, viewerId: string) {
    onboardingQuery.mockReturnValue({ data: o, isLoading: false, error: null, refetch: vi.fn() })
    me.mockReturnValue({ data: { associate_id: viewerId } })
    const m = en.associates.portal
    return render(
      withI18n(
        <OnboardingDetail
          onboardingId={o.onboarding_id}
          portalBase="/preferred/portal"
          sharedCopy={m.shared}
          proposalCopy={m.proposal}
          agreementCopy={m.agreement}
          checklistCopy={m.checklist}
          estimateCopy={m.estimate}
          executionCopy={m.execution}
          paymentsCopy={m.payments}
        />
      )
    )
  }

  beforeEach(() => {
    surveyMocks.status.mockReturnValue({ data: { ...SURVEY_STATUS_EMPTY, signatures: { ...SURVEY_STATUS_EMPTY.signatures, customer: { signed: true, signed_at: '2026-10-12T05:00:00Z' } } }, isLoading: false, error: null, refetch: vi.fn() })
    surveyMocks.results.mockReturnValue({ data: SURVEY_RESULTS, isLoading: false, error: null, refetch: vi.fn() })
  })

  it('owner: status, signatures, suggested kW, and a link back into the survey — no price', () => {
    renderDetail(makeOnboarding({ onboarding_id: 41 }), 'GNA-1')
    const card = screen.getByTestId('survey-card')
    expect(card).toHaveTextContent(en.survey.card.incomplete)
    expect(card).toHaveTextContent(en.survey.card.customerSigned)
    expect(card).toHaveTextContent(en.survey.card.associateUnsigned)
    expect(screen.getByTestId('survey-card-kw')).toHaveTextContent('3 kW')
    expect(card).not.toHaveTextContent('₹')
    expect(screen.getByRole('link', { name: en.survey.card.continue })).toHaveAttribute('href', expect.stringContaining('/customers/41/edit?step=survey'))
  })

  it('territory Preferred viewer: read-only card, no signing link, agreement (always 403) hidden, masked contact shown as sent', async () => {
    renderDetail(
      makeOnboarding({ onboarding_id: 42, owner: { associate_id: 'GNA-9', full_name: 'Other', associate_type: 'associate' }, customer: { name: 'Bikash Das', mobile: '******0000', email: 'b***@example.com' }, can_edit: false }),
      'GNA-PREF'
    )
    expect(screen.getByTestId('survey-card')).toHaveTextContent(en.survey.card.readOnlyNote)
    expect(screen.queryByRole('link', { name: en.survey.card.continue })).not.toBeInTheDocument()
    expect(screen.getByText('******0000')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(en.associates.portal.agreement.title)).not.toBeInTheDocument())
    expect(agreementQuery).not.toHaveBeenCalled()
  })

  it('grandfathered: the card says the survey is not required', () => {
    surveyMocks.status.mockReturnValue({ data: { ...SURVEY_STATUS_EMPTY, grandfathered: true }, isLoading: false, error: null, refetch: vi.fn() })
    renderDetail(makeOnboarding({ onboarding_id: 43 }), 'GNA-1')
    expect(screen.getByTestId('survey-card-not-required')).toHaveTextContent(en.survey.card.notRequired)
  })
})
