import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { en, withI18n } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { ONBOARDING_OPTIONS, SURVEY_RESULTS, makeOnboarding } from './fixtures/survey-contract'
import { STATUS_REVISIT } from './fixtures/survey-review-contract'
import { resetSurveyMocks, surveyMocks } from './helpers/survey-mocks'

// FE-8 on the associate's customer detail: the BE-11 attribution line and the
// BE-10 estimated commission. Same harness as survey-review-associate.test.tsx.
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
const me = vi.fn()
vi.mock('@/lib/associate/api-client', () => ({ useAssociateMe: () => me() }))
const onboardingQuery = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboarding: () => onboardingQuery(),
  useOnboardingOptions: () => ({ data: ONBOARDING_OPTIONS, isLoading: false, error: null }),
  useOnboardingProgress: () => ({ data: undefined }),
  useRequestFormalProposal: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useOnboardingFormalProposal: () => ({ data: { prepared: false, missing_fields: [] }, isLoading: false }),
  useInPersonAcceptance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingAgreement: () => ({ data: { links: { agreement_pdf: null } }, isLoading: false }),
  useUploadSignedAgreement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingEstimates: () => ({ data: [], isLoading: false }),
  useCreateEstimate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('@/lib/pricing/usePackageCatalogue', () => ({ usePackageCatalogue: () => ({ catalogue: null }) }))

import OnboardingDetail from '@/components/associate/OnboardingDetail'

const ok = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })

function renderDetail(over: Parameters<typeof makeOnboarding>[0] = {}) {
  onboardingQuery.mockReturnValue(ok(makeOnboarding(over)))
  const p = en.associates.portal
  return render(
    withI18n(
      <OnboardingDetail
        onboardingId={501}
        portalBase="/associates/portal"
        sharedCopy={p.shared}
        proposalCopy={p.proposal}
        agreementCopy={p.agreement}
        checklistCopy={p.checklist}
        estimateCopy={p.estimate}
        executionCopy={p.execution}
        paymentsCopy={p.payments}
      />
    )
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  me.mockReturnValue(ok({ associate_id: 'GNA-1' }))
  surveyMocks.results.mockReturnValue(ok(SURVEY_RESULTS))
  surveyMocks.status.mockReturnValue(ok(STATUS_REVISIT))
})

describe('F8 — attribution lock until the project is completed or closed', () => {
  it('locked: the A7 wording', () => {
    renderDetail({ attribution: { locked: true, released_reason: null, under_review: false } })
    expect(screen.getByTestId('attribution-locked')).toHaveTextContent('Attributed to you until the project is completed or closed.')
  })

  it('not locked (before verification, or released): nothing', () => {
    renderDetail({ attribution: { locked: false, released_reason: null, under_review: false } })
    expect(screen.queryByTestId('attribution-locked')).toBeNull()
  })

  it('released after a lost lead: nothing either', () => {
    renderDetail({ attribution: { locked: false, released_reason: 'lead_lost', under_review: false } })
    expect(screen.queryByTestId('attribution-locked')).toBeNull()
  })

  it('the wording exists in all three languages and no date or day count remains in the types', async () => {
    expect(en.portalEase.attribution.locked).toBe('Attributed to you until the project is completed or closed.')
    expect(hi.portalEase.attribution.locked).toBeTruthy()
    expect(bn.portalEase.attribution.locked).toBeTruthy()
    const { readFileSync } = await import('node:fs')
    const types = readFileSync('lib/associate/onboarding-types.ts', 'utf8')
    expect(types).not.toMatch(/locked_until|attribution_lock_days/)
  })
})

describe('F4 — estimated commission on the customer detail', () => {
  it('shows the amount, basis and policy link', () => {
    renderDetail({ estimated_commission: { amount: '5000.00', rate: '5.0000', basis: 'accepted_proposal', value_used: '108900.00', basis_amount: '100000.00', pending_reason: null } })
    const note = screen.getByTestId('estimated-commission')
    expect(note).toHaveTextContent('Estimated commission ₹5,000.00')
    expect(note).toHaveTextContent(en.portalEase.commission.basis.accepted_proposal)
    expect(screen.getByRole('link', { name: en.portalEase.commission.policyLink })).toHaveAttribute('href', '/commission-policy')
  })

  it('null (e.g. a territory viewer): nothing', () => {
    renderDetail({ estimated_commission: null })
    expect(screen.queryByTestId('estimated-commission')).toBeNull()
  })
})
