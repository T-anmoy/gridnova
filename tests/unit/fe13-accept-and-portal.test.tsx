import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { AcceptPanel } from '@/app/(internal)/proposal/accept/[token]/AcceptPanel'
import { AcceptedBody } from '@/app/(internal)/proposal/accept/[token]/AcceptShell'
import { normalizeAcceptResponse, validateAcceptResponse } from '@/lib/proposal-accept'
import { ApiError } from '@/lib/dashboard/api-error'
import { ACCEPT_DOCUMENT, ACCEPT_GET_WITH_DOCUMENT } from './fixtures/proposal-document-contract'
import { ACCEPT_VIEW_FIXTURE } from './fixtures/accept-contract'
import { en, withI18n } from './helpers/i18n'
import { ONBOARDING_OPTIONS, SURVEY_RESULTS, makeOnboarding } from './fixtures/survey-contract'
import { STATUS_REVISIT } from './fixtures/survey-review-contract'
import { resetSurveyMocks, surveyMocks } from './helpers/survey-mocks'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
const me = vi.fn()
vi.mock('@/lib/associate/api-client', () => ({ useAssociateMe: () => me() }))
const onboardingQuery = vi.fn()
const formalQuery = vi.fn()
const inPerson = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboarding: () => onboardingQuery(),
  useOnboardingOptions: () => ({ data: ONBOARDING_OPTIONS, isLoading: false, error: null }),
  useOnboardingProgress: () => ({ data: undefined }),
  useRequestFormalProposal: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useOnboardingFormalProposal: () => formalQuery(),
  useInPersonAcceptance: () => ({ mutateAsync: inPerson, isPending: false }),
  useOnboardingAgreement: () => ({ data: { links: { agreement_pdf: null } }, isLoading: false }),
  useUploadSignedAgreement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingEstimates: () => ({ data: [], isLoading: false }),
  useCreateEstimate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('@/lib/pricing/usePackageCatalogue', () => ({ usePackageCatalogue: () => ({ catalogue: null }) }))

import OnboardingDetail from '@/components/associate/OnboardingDetail'

const ok = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })
const view = (raw: unknown) => normalizeAcceptResponse(validateAcceptResponse(raw))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('accept page — BE-13 document', () => {
  it('shows reference, date, totals, words, schedule, subsidy and scope exactly as the backend sent them', () => {
    render(<AcceptPanel token="tok" view={view(ACCEPT_GET_WITH_DOCUMENT)} />)
    const doc = screen.getByTestId('accept-document')
    expect(doc).toHaveTextContent('GN/23/10/2026/01')
    expect(screen.getByTestId('accept-total')).toHaveTextContent('₹2,01,465.00')
    expect(doc).toHaveTextContent('Rupees Two Lakh One Thousand Four Hundred Sixty-Five Only')
    expect(doc).toHaveTextContent('20% — On Order')
    expect(doc).toHaveTextContent('₹1,20,879.00')
    expect(screen.getByTestId('accept-subsidy')).toHaveTextContent('₹78,000.00')
    expect(screen.getByTestId('accept-subsidy')).toHaveTextContent('₹1,23,465.00')
    expect(doc).toHaveTextContent('Shadow-free roof area of 250–300 sq ft.')
    expect(doc).toHaveTextContent('3 kWp')
    expect(doc).toHaveTextContent('Compact')
    expect(screen.getByRole('link', { name: /download proposal/i })).toBeInTheDocument()
  })

  it('hides subsidy and effective cost when the subsidy does not apply', () => {
    render(<AcceptPanel token="tok" view={view({ ...ACCEPT_GET_WITH_DOCUMENT, document: { ...ACCEPT_DOCUMENT, subsidy: { applies: false, slabs: [], total: null, effective_cost: null } } })} />)
    expect(screen.queryByTestId('accept-subsidy')).not.toBeInTheDocument()
    expect(screen.queryByText(/effective cost/i)).not.toBeInTheDocument()
  })

  it('an older proposal (document null) keeps the earlier page', () => {
    render(<AcceptPanel token="tok" view={view(ACCEPT_VIEW_FIXTURE)} />)
    expect(screen.queryByTestId('accept-document')).not.toBeInTheDocument()
    expect(screen.getByText(/total price/i)).toBeInTheDocument()
  })

  it('after accepting, the document stays on screen (the POST reply carries none)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'accepted', proposal_id: 12, accepted_at: '2026-10-24T10:00:00Z' }), { status: 200 })))
    render(<AcceptPanel token="tok" view={view(ACCEPT_GET_WITH_DOCUMENT)} />)
    fireEvent.click(screen.getByRole('button', { name: /accept proposal/i }))
    expect(await screen.findByText('Proposal accepted')).toBeInTheDocument()
    expect(screen.getByTestId('accept-total')).toHaveTextContent('₹2,01,465.00')
  })

  it('the accepted screen shows the document too', () => {
    render(<AcceptedBody token="tok" view={view({ ...ACCEPT_GET_WITH_DOCUMENT, state: 'accepted', accepted_at: '2026-10-24T10:00:00Z' })} />)
    expect(screen.getByTestId('accept-document')).toHaveTextContent('GN/23/10/2026/01')
  })
})

describe('associate portal — the formal proposal is the customer’s PDF, read-only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSurveyMocks()
    me.mockReturnValue(ok({ associate_id: 'GNA-1' }))
    surveyMocks.results.mockReturnValue(ok(SURVEY_RESULTS))
    surveyMocks.status.mockReturnValue(ok(STATUS_REVISIT))
    onboardingQuery.mockReturnValue(ok(makeOnboarding()))
  })

  function renderDetail() {
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
        />,
      ),
    )
  }

  const prepared = {
    prepared: true,
    proposal_id: 12,
    version: 1,
    status: 'approved',
    total_value: 201465,
    approved_at: '2026-10-23T09:00:00Z',
    date_sent: null,
    accepted_at: null,
    ready_to_hand_over: true,
    pdf: { url: 'https://r2.example/signed/proposal-12.pdf', expires_at: '2026-10-24T12:00:00Z' },
  }

  it('links the signed final PDF with the read-only note, and offers no editing', () => {
    formalQuery.mockReturnValue({ data: prepared, isLoading: false })
    renderDetail()
    expect(screen.getByRole('link', { name: /View PDF/ })).toHaveAttribute('href', prepared.pdf.url)
    expect(screen.getByText(en.associates.portal.proposal.detail.pdfNote)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Save / })).not.toBeInTheDocument()
  })

  it('a 409 missing_required on in-person acceptance shows the plain message', async () => {
    formalQuery.mockReturnValue({ data: prepared, isLoading: false })
    inPerson.mockRejectedValue(new ApiError(409, 'x', 'This proposal cannot be approved or sent yet', { code: 'missing_required', missing: [] }))
    const user = userEvent.setup()
    renderDetail()
    await user.click(screen.getByRole('button', { name: en.associates.portal.proposal.acceptance.title }))
    await user.click(screen.getByRole('button', { name: en.associates.portal.proposal.acceptance.submitButton }))
    await waitFor(() => expect(screen.getByText(en.associates.portal.proposal.acceptance.errors.missing_required)).toBeInTheDocument())
  })
})

describe('no hard-coded signatory, rate, price, warranty or reference in the new code', () => {
  const root = path.resolve(__dirname, '../..')
  const dir = path.join(root, 'components/dashboard/proposal-document')
  const files = [
    ...readdirSync(dir).map((f) => path.join(dir, f)),
    path.join(root, 'components/dashboard/AdjustPricingDialog.tsx'),
    path.join(root, 'lib/proposals/document-logic.ts'),
    path.join(root, 'lib/proposals/document-types.ts'),
    path.join(root, 'lib/proposals/document-api-client.ts'),
  ]
  const acceptShell = readFileSync(path.join(root, 'app/(internal)/proposal/accept/[token]/AcceptShell.tsx'), 'utf8')
  const summary = acceptShell.slice(acceptShell.indexOf('export function DocumentSummary'), acceptShell.indexOf('export function AcceptedBody'))
  const sources = [...files.map((f) => ({ name: path.relative(root, f), text: readFileSync(f, 'utf8') })), { name: 'AcceptShell DocumentSummary', text: summary }]

  const FORBIDDEN: [string, RegExp][] = [
    ['signatory name', /raju\s*paul/i],
    ['a rupee amount', /(₹|Rs\.?)\s?\d/],
    ['an Indian-grouped amount', /\b\d{1,2},\d{2},\d{3}\b/],
    // (hex colours like #111827 are not figures)
    ['a five-digit figure', /(?<![#\w])\d{5,}\b/],
    ['the GST rate', /\b0?\.089\b|8\.9\s*%|\b18\s*%/],
    ['a warranty term', /\b\d+\s*(years?|yrs?)\b/i],
    ['a reference', /GN\/\d/],
    ['a validity period', /\b\d+\s*days\b/],
    ['a per-kWp rate', /per\s*kwp[^'"\n]{0,12}\d/i],
  ]

  it.each(FORBIDDEN)('none contains %s', (_what, re) => {
    expect(sources.length).toBeGreaterThan(10)
    for (const s of sources) expect(s.text, s.name).not.toMatch(re)
  })
})
