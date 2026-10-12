import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { ONBOARDING_OPTIONS, SURVEY_RESULTS, makeOnboarding } from './fixtures/survey-contract'
import { CORRECTION_PENDING, STATUS_FEASIBLE, STATUS_REVISIT } from './fixtures/survey-review-contract'
import { resetSurveyMocks, surveyMocks } from './helpers/survey-mocks'
import { ApiError } from '@/lib/dashboard/api-error'
import { describeTodo, todoHref } from '@/lib/onboarding/todo'
import type { HomeItem } from '@/lib/associate/home-api-client'
import type { SurveyStatus } from '@/lib/associate/survey-types'

vi.mock('@/lib/associate/portal-session', async (orig) => ({ ...(await orig<object>()), ...(await import('./helpers/survey-mocks')).portalSessionOverrides }))
vi.mock('@/lib/associate/survey-api-client', async () => (await import('./helpers/survey-mocks')).surveyClientModule)
const me = vi.fn()
vi.mock('@/lib/associate/api-client', () => ({ useAssociateMe: () => me() }))
const onboardingQuery = vi.fn()
const requestFormal = vi.fn()
const formalProposal = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboarding: () => onboardingQuery(),
  useOnboardingOptions: () => ({ data: ONBOARDING_OPTIONS, isLoading: false, error: null }),
  useOnboardingProgress: () => ({ data: undefined }),
  useRequestFormalProposal: () => ({ mutateAsync: requestFormal, isPending: false, isSuccess: false }),
  useOnboardingFormalProposal: () => formalProposal(),
  useInPersonAcceptance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingAgreement: () => ({ data: { links: { agreement_pdf: null } }, isLoading: false }),
  useUploadSignedAgreement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOnboardingEstimates: () => ({ data: [], isLoading: false }),
  useCreateEstimate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('@/lib/pricing/usePackageCatalogue', () => ({ usePackageCatalogue: () => ({ catalogue: null }) }))

import OnboardingDetail from '@/components/associate/OnboardingDetail'
import CorrectionRequest from '@/components/associate/survey/CorrectionRequest'

const ok = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })
const OWNER = { associate_id: 'GNA-1' }

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
const setStatus = (s: SurveyStatus) => surveyMocks.status.mockReturnValue(ok(s))

beforeEach(() => {
  vi.clearAllMocks()
  resetSurveyMocks()
  me.mockReturnValue(ok(OWNER))
  surveyMocks.results.mockReturnValue(ok(SURVEY_RESULTS))
  formalProposal.mockReturnValue({ data: { prepared: false, missing_fields: [] }, isLoading: false })
  requestFormal.mockResolvedValue({})
  setStatus(STATUS_REVISIT)
})

describe('Review outcome on the customer detail', () => {
  it('shows the outcome badge, the engineer note and — for a revisit — each item with a deep link to its wizard step', () => {
    renderDetail({ status: 'submitted', can_edit: true })
    expect(screen.getByTestId('review-outcome')).toHaveTextContent(en.survey.review.outcomes.revisit_needed)
    expect(screen.getByText(/Terrace area looks too large/)).toBeInTheDocument()
    const item = screen.getByTestId('revisit-item-0')
    // roof_area is held by the "house" wizard step (FE-1's mapping).
    const link = within(item).getByRole('link')
    expect(link.getAttribute('href')).toMatch(/\/associates\/portal\/customers\/501\/edit\?step=house$/)
    expect(item).toHaveTextContent('Measure the terrace again')
  })

  it('maps every section to the step that holds it', () => {
    setStatus({
      ...STATUS_REVISIT,
      review: { ...STATUS_REVISIT.review!, revisit_items: [
        { section: 'connection', field: null, note: 'a' }, { section: 'bills', field: null, note: 'b' }, { section: 'roof', field: null, note: 'c' }, { section: 'layout', field: null, note: 'd' }, { section: 'something_new', field: null, note: 'e' },
      ] },
    })
    renderDetail({ status: 'draft', can_edit: true })
    const steps = [0, 1, 2, 3, 4].map((i) => within(screen.getByTestId(`revisit-item-${i}`)).getByRole('link').getAttribute('href')!.split('step=')[1])
    expect(steps).toEqual(['connection', 'bills', 'house', 'layout', 'survey'])
  })

  it('a verified customer cannot be edited: it points to a correction request instead of the wizard', () => {
    renderDetail({ status: 'verified', can_edit: false })
    const banner = screen.getByTestId('revisit-banner')
    const links = within(banner).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toMatch(/survey-correction$/)
    expect(banner.querySelector('[href*="step="]')).toBeNull()
  })

  it('a territory Preferred Associate only reads: no step links, no correction link, no report', () => {
    me.mockReturnValue(ok({ associate_id: 'GNA-OTHER' }))
    setStatus({ ...STATUS_FEASIBLE })
    renderDetail({ status: 'verified', can_edit: false })
    expect(screen.queryByTestId('request-correction-link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('survey-report')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resign-signatures')).not.toBeInTheDocument()
    expect(screen.getByText(en.survey.card.readOnlyNote)).toBeInTheDocument()
  })

  it('shows conditions for a conditional pass, and says when the survey changed after the review', () => {
    setStatus({ ...STATUS_FEASIBLE, review: { ...STATUS_FEASIBLE.review!, outcome: 'feasible_with_conditions', conditions: ['Reinforce the parapet'], revised_after_review: true } })
    renderDetail({ status: 'submitted', can_edit: true })
    expect(screen.getByText('Reinforce the parapet')).toBeInTheDocument()
    expect(screen.getByTestId('review-revised')).toBeInTheDocument()
  })

  it('says the review is pending when the survey is complete but unreviewed', () => {
    setStatus({ ...STATUS_FEASIBLE, review: { ...STATUS_FEASIBLE.review!, outcome: null } })
    renderDetail({ status: 'submitted', can_edit: false })
    expect(screen.getByTestId('review-pending')).toBeInTheDocument()
  })
})

describe('Report download (owner only)', () => {
  it('is hidden until a report exists', () => {
    setStatus({ ...STATUS_FEASIBLE, report: { generated_at: null } })
    renderDetail({ status: 'verified' })
    expect(screen.queryByTestId('survey-report')).not.toBeInTheDocument()
  })

  it('fetches a fresh signed link on every click and opens it', async () => {
    setStatus(STATUS_FEASIBLE)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderDetail({ status: 'verified' })
    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: en.survey.report.download })
    await user.click(btn)
    await user.click(btn)
    await waitFor(() => expect(surveyMocks.reportLink).toHaveBeenCalledTimes(2))
    expect(open).toHaveBeenCalledWith('https://files.example/report.pdf', '_blank', 'noopener,noreferrer')
  })

  it.each([
    [403, undefined, 'forbidden'],
    [404, 'report_not_generated', 'report_not_generated'],
    [503, 'storage_not_configured', 'storage_not_configured'],
  ] as const)('translates %s %s to plain text', async (status, code, key) => {
    setStatus(STATUS_FEASIBLE)
    surveyMocks.reportLink.mockRejectedValueOnce(new ApiError(status, 'x', 'English text from the server', code ? { code } : undefined))
    renderDetail({ status: 'verified' })
    await userEvent.setup().click(screen.getByRole('button', { name: en.survey.report.download }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent((en.survey.report.errors as Record<string, string>)[key])
    expect(alert.textContent).not.toMatch(/English text from the server/)
  })
})

describe('Re-signing after a correction (verified customer)', () => {
  const cleared = (over: Partial<SurveyStatus> = {}): SurveyStatus => ({
    ...STATUS_FEASIBLE,
    signatures: { customer: { signed: false, signed_at: null }, associate: { signed: true, signed_at: '2026-10-12T05:02:00+00:00' } },
    ...over,
  })

  it('the owner gets the pad for the missing party only', () => {
    setStatus(cleared())
    renderDetail({ status: 'verified', can_edit: false })
    expect(screen.getByTestId('resign-signatures')).toBeInTheDocument()
    expect(screen.getByTestId('signature-customer')).toBeInTheDocument()
    expect(screen.queryByTestId('signature-associate')).not.toBeInTheDocument()
  })

  it('is not offered on a draft (the wizard handles that), a grandfathered customer, or an incomplete survey', () => {
    for (const [status, over] of [['draft', {}], ['verified', { grandfathered: true }], ['verified', { complete: false }]] as const) {
      setStatus(cleared(over))
      const { unmount } = renderDetail({ status })
      expect(screen.queryByTestId('resign-signatures')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('is not offered to anyone but the owner', () => {
    me.mockReturnValue(ok({ associate_id: 'GNA-OTHER' }))
    setStatus(cleared())
    renderDetail({ status: 'verified' })
    expect(screen.queryByTestId('resign-signatures')).not.toBeInTheDocument()
  })
})

describe('Formal proposal (N1 owner-only + the review gate)', () => {
  it('a territory viewer sees the status read-only: no request button', () => {
    me.mockReturnValue(ok({ associate_id: 'GNA-OTHER' }))
    renderDetail({ status: 'submitted' })
    expect(screen.queryByRole('button', { name: en.associates.portal.proposal.requestButton })).not.toBeInTheDocument()
  })

  it('a territory viewer gets no in-person acceptance form either', () => {
    me.mockReturnValue(ok({ associate_id: 'GNA-OTHER' }))
    formalProposal.mockReturnValue({ data: { prepared: true, proposal_id: 9, version: 1, status: 'sent', total_value: null, approved_at: null, date_sent: null, accepted_at: null, ready_to_hand_over: true, pdf: null }, isLoading: false })
    renderDetail({ status: 'submitted' })
    expect(screen.queryByRole('button', { name: en.associates.portal.proposal.acceptance.title })).not.toBeInTheDocument()
    expect(screen.getByText(en.associates.portal.proposal.detail.preparedTitle)).toBeInTheDocument()
  })

  it('the owner still gets both controls', () => {
    renderDetail({ status: 'submitted' })
    expect(screen.getByRole('button', { name: en.associates.portal.proposal.requestButton })).toBeEnabled()
    formalProposal.mockReturnValue({ data: { prepared: true, proposal_id: 9, version: 1, status: 'sent', total_value: 100, approved_at: null, date_sent: null, accepted_at: null, ready_to_hand_over: true, pdf: null }, isLoading: false })
    renderDetail({ status: 'submitted' })
    expect(screen.getByRole('button', { name: en.associates.portal.proposal.acceptance.title })).toBeInTheDocument()
  })

  it('a not_feasible review disables the request up front, with the reason', () => {
    setStatus({ ...STATUS_FEASIBLE, review: { ...STATUS_FEASIBLE.review!, outcome: 'not_feasible', notes: 'Shaded' } })
    renderDetail({ status: 'submitted' })
    expect(screen.getByRole('button', { name: en.associates.portal.proposal.requestButton })).toBeDisabled()
    expect(screen.getByTestId('proposal-gate')).toHaveTextContent(en.survey.gate.survey_not_feasible)
  })

  it('409 survey_review_required becomes a translated message and then keeps the button off', async () => {
    requestFormal.mockRejectedValue(new ApiError(409, 'x', 'English from server', { code: 'survey_review_required', review_outcome: null, revised_after_review: false }))
    renderDetail({ status: 'submitted' })
    await userEvent.setup().click(screen.getByRole('button', { name: en.associates.portal.proposal.requestButton }))
    const msg = await screen.findByTestId('proposal-gate')
    expect(msg).toHaveTextContent(en.survey.gate.review_required)
    expect(msg.textContent).not.toMatch(/English from server/)
    expect(screen.getByRole('button', { name: en.associates.portal.proposal.requestButton })).toBeDisabled()
  })
})

describe('Home to-dos for the new message keys', () => {
  const item = (message_key: string, params: Record<string, unknown>, kind: string): HomeItem => ({ kind, message_key, onboarding_id: 7, customer_name: 'Asha', priority: 1, params })
  const revisit = (via: 'edit' | 'correction') => item('todo.survey_revisit_needed', { revisit_items: [{ section: 'layout', field: null, note: 'x' }], notes: 'n', via }, 'survey_revisit_needed')
  const resign = item('todo.survey_resign_needed', { unsigned: ['customer', 'associate'] }, 'survey_resign_needed')

  it('describes both in English, never as a raw key', () => {
    expect(describeTodo(revisit('edit'), en.associates.portal.feed, {})).toBe(en.associates.portal.feed.todo.survey_revisit_edit)
    expect(describeTodo(revisit('correction'), en.associates.portal.feed, {})).toBe(en.associates.portal.feed.todo.survey_revisit_correction)
    const text = describeTodo(resign, en.associates.portal.feed, {})
    expect(text).toContain('customer')
    expect(text).not.toMatch(/todo\./)
  })

  it('has Hindi and Bengali text that differs from English', () => {
    for (const lang of [hi, bn]) {
      const feed = lang.associates.portal.feed as typeof en.associates.portal.feed
      expect(describeTodo(revisit('edit'), feed, {})).not.toBe(en.associates.portal.feed.todo.survey_revisit_edit)
      expect(describeTodo(resign, feed, {})).toContain(feed.todo.party_customer)
    }
  })

  it('links a revisit to the wizard step of its first item, or to the correction request once verified', () => {
    expect(todoHref(revisit('edit'), '/associates/portal')).toBe('/associates/portal/customers/7/edit?step=layout')
    expect(todoHref(revisit('correction'), '/associates/portal')).toBe('/associates/portal/customers/7/survey-correction')
    expect(todoHref(resign, '/preferred/portal')).toBe('/preferred/portal/customers/7')
  })
})

describe('Correction request page', () => {
  const verified = () => onboardingQuery.mockReturnValue(ok(makeOnboarding({ status: 'verified', can_edit: false })))
  const c = en.survey.corrections
  const view = () => render(withI18n(<CorrectionRequest onboardingId={501} portalBase="/associates/portal" />))

  it('only the owner can request', () => {
    verified()
    me.mockReturnValue(ok({ associate_id: 'GNA-OTHER' }))
    view()
    expect(screen.getByTestId('correction-owner-only')).toBeInTheDocument()
    expect(screen.queryByTestId('correction-form')).not.toBeInTheDocument()
  })

  it('a draft/submitted customer is told to edit directly', () => {
    onboardingQuery.mockReturnValue(ok(makeOnboarding({ status: 'submitted' })))
    view()
    expect(screen.getByTestId('correction-not-verified')).toBeInTheDocument()
    expect(screen.queryByTestId('correction-form')).not.toBeInTheDocument()
  })

  it('one request at a time: a pending request blocks a new one', () => {
    verified()
    surveyMocks.corrections.mockReturnValue(ok({ items: [CORRECTION_PENDING] }))
    view()
    expect(screen.getByTestId('correction-pending-block')).toHaveTextContent(c.pendingBlock)
    expect(screen.queryByTestId('correction-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('correction-4')).toHaveAttribute('data-status', 'pending')
  })

  it('shows the history with the reviewer note', () => {
    verified()
    surveyMocks.corrections.mockReturnValue(ok({ items: [{ ...CORRECTION_PENDING, status: 'rejected', review_note: 'Photos do not match' }] }))
    view()
    expect(screen.getByText('Photos do not match')).toBeInTheDocument()
    expect(screen.getByText(c.statuses.rejected)).toBeInTheDocument()
  })

  it('never offers the consumer number: it is read-only', async () => {
    verified()
    view()
    await userEvent.setup().click(screen.getByRole('checkbox', { name: c.areas.connection }))
    expect(screen.getByLabelText(en.survey.connection.consumerNumberLabel)).toHaveAttribute('readonly')
  })

  it('needs at least one change and a reason, and says so', async () => {
    verified()
    const user = userEvent.setup()
    view()
    await user.click(screen.getByRole('checkbox', { name: c.areas.connection }))
    await user.click(screen.getByRole('button', { name: c.submit }))
    expect(await screen.findByText(c.reasonRequired)).toBeInTheDocument()
    expect(screen.getByLabelText(c.reasonLabel)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(c.noChanges)
    expect(surveyMocks.requestCorrection).not.toHaveBeenCalled()
  })

  it('sends only the changed fields and the reason, then confirms', async () => {
    verified()
    const user = userEvent.setup()
    view()
    await user.click(screen.getByRole('checkbox', { name: c.areas.connection }))
    const load = screen.getByLabelText(en.survey.connection.sanctionedLoadLabel)
    await user.clear(load)
    await user.type(load, '7.5')
    expect(screen.getByTestId('correction-preview')).toHaveTextContent('7.5')
    await user.type(screen.getByLabelText(c.reasonLabel), 'Meter plate says 7.5')
    await user.click(screen.getByRole('button', { name: c.submit }))
    await waitFor(() => expect(surveyMocks.requestCorrection).toHaveBeenCalledWith({ id: 501, changes: { sanctioned_load_kw: 7.5 }, reason: 'Meter plate says 7.5' }))
    expect(await screen.findByTestId('correction-sent')).toHaveTextContent(c.sent)
  })

  it.each(['correction_pending', 'edit_directly', 'not_editable', 'field_not_correctable'] as const)('translates the %s error', async (code) => {
    verified()
    surveyMocks.requestCorrection.mockRejectedValue(new ApiError(409, 'x', 'English from the server', { code }))
    const user = userEvent.setup()
    view()
    await user.click(screen.getByRole('checkbox', { name: c.areas.connection }))
    const load = screen.getByLabelText(en.survey.connection.sanctionedLoadLabel)
    await user.clear(load)
    await user.type(load, '9')
    await user.type(screen.getByLabelText(c.reasonLabel), 'because')
    await user.click(screen.getByRole('button', { name: c.submit }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(c.errors[code])
    expect(alert.textContent).not.toMatch(/English from the server/)
  })
})
