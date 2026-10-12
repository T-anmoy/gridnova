import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/dashboard/api-error'
import { SURVEY_RESULTS } from './fixtures/survey-contract'
import { STATUS_FEASIBLE, STATUS_REVISIT } from './fixtures/survey-review-contract'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))

const status = vi.fn()
const results = vi.fn()
const submit = vi.fn()
const generate = vi.fn()
const reportLink = vi.fn()
vi.mock('@/lib/dashboard/survey-review-api-client', () => ({
  useStaffSurvey: () => status(),
  useStaffSurveyResults: () => results(),
  useSubmitSurveyReview: () => ({ mutateAsync: submit, isPending: false }),
  useGenerateSurveyReport: () => ({ mutateAsync: generate, isPending: false }),
  fetchStaffSurveyReportLink: (...a: unknown[]) => reportLink(...a),
}))

import SurveyPanel from '@/components/dashboard/SurveyPanel'

const ok = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })
const { estimate: _estimate, ...RESULTS_NO_ESTIMATE } = SURVEY_RESULTS
void _estimate

beforeEach(() => {
  vi.clearAllMocks()
  status.mockReturnValue(ok({ ...STATUS_REVISIT, review: { ...STATUS_REVISIT.review!, outcome: null, revisit_items: [], notes: null, reviewed_at: null } }))
  results.mockReturnValue(ok(RESULTS_NO_ESTIMATE))
  submit.mockResolvedValue({})
})

describe('SurveyPanel — who sees what', () => {
  it('renders nothing for operations and accounts (the survey routes would 403)', () => {
    for (const role of ['operations', 'accounts'] as const) {
      const { container, unmount } = render(<SurveyPanel onboardingId={12} role={role} />)
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })

  it.each(['sales', 'management'] as const)('%s reads the survey but gets no review form and cannot generate a report', (role) => {
    render(<SurveyPanel onboardingId={12} role={role} />)
    expect(screen.getByTestId('survey-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('review-form')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generate report/i })).not.toBeInTheDocument()
  })

  it.each(['admin', 'engineer'] as const)('%s gets the review form', (role) => {
    render(<SurveyPanel onboardingId={12} role={role} />)
    expect(screen.getByTestId('review-form')).toBeInTheDocument()
  })

  it("an engineer's results carry no estimate: no price block, never an empty one", () => {
    render(<SurveyPanel onboardingId={12} role="engineer" />)
    expect(screen.getByTestId('staff-survey-results')).toBeInTheDocument()
    expect(screen.queryByTestId('staff-survey-estimate')).not.toBeInTheDocument()
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument()
  })

  it('shows signatures with times and the typed declaration name', () => {
    status.mockReturnValue(ok(STATUS_REVISIT))
    render(<SurveyPanel onboardingId={12} role="admin" />)
    expect(screen.getByTestId('panel-signature-customer')).toHaveTextContent(/Signed/)
    expect(screen.getByText(/Asha Roy/)).toBeInTheDocument()
    expect(screen.getByTestId('review-outcome')).toHaveTextContent('Revisit needed')
    expect(screen.getByText(/Measure the terrace again/)).toBeInTheDocument()
  })
})

describe('SurveyPanel — review form conditional requirements', () => {
  it('feasible_with_conditions needs at least one condition (aria-invalid, focused, nothing sent)', async () => {
    const user = userEvent.setup()
    render(<SurveyPanel onboardingId={12} role="engineer" />)
    await user.click(screen.getByRole('radio', { name: 'Feasible with conditions' }))
    await user.click(screen.getByRole('button', { name: 'Record review' }))
    expect(await screen.findByText('Add at least one condition.')).toBeInTheDocument()
    expect(screen.getByLabelText('Condition 1')).toHaveAttribute('aria-invalid', 'true')
    expect(submit).not.toHaveBeenCalled()
  })

  it('not_feasible needs notes', async () => {
    const user = userEvent.setup()
    render(<SurveyPanel onboardingId={12} role="engineer" />)
    await user.click(screen.getByRole('radio', { name: 'Not feasible' }))
    await user.click(screen.getByRole('button', { name: 'Record review' }))
    expect(await screen.findByText('Notes are required for this outcome.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes/)).toHaveAttribute('aria-invalid', 'true')
    expect(submit).not.toHaveBeenCalled()
  })

  it('revisit_needed needs an item with a section (from the survey, not free text) and a note', async () => {
    const user = userEvent.setup()
    render(<SurveyPanel onboardingId={12} role="engineer" />)
    await user.click(screen.getByRole('radio', { name: 'Revisit needed' }))
    await user.type(screen.getByLabelText(/Notes/), 'Check the roof')
    await user.click(screen.getByRole('button', { name: 'Record review' }))
    expect(await screen.findByText('Choose a section.')).toBeInTheDocument()
    expect(screen.getByLabelText('Section')).toHaveAttribute('aria-invalid', 'true')
    expect(submit).not.toHaveBeenCalled()
    const section = screen.getByLabelText('Section') as HTMLSelectElement
    expect([...section.options].map((o) => o.value)).toEqual(['', 'connection', 'bills', 'roof', 'roof_area', 'layout'])
  })

  it('sends the right body after a confirm dialog', async () => {
    const user = userEvent.setup()
    render(<SurveyPanel onboardingId={12} role="engineer" />)
    await user.click(screen.getByRole('radio', { name: 'Revisit needed' }))
    await user.type(screen.getByLabelText(/Notes/), 'Check the roof')
    await user.selectOptions(screen.getByLabelText('Section'), 'roof_area')
    await user.selectOptions(screen.getByLabelText('Field (optional)'), 'roof_area_sqft')
    await user.type(screen.getByLabelText('What to check again'), 'Measure again')
    await user.click(screen.getByRole('button', { name: 'Record review' }))
    expect(submit).not.toHaveBeenCalled() // the dialog comes first
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ id: 12, input: { outcome: 'revisit_needed', notes: 'Check the roof', revisit_items: [{ section: 'roof_area', field: 'roof_area_sqft', note: 'Measure again' }] } }))
  })

  it('shows the 409 precondition as a plain sentence', async () => {
    submit.mockRejectedValue(new ApiError(409, 'API error 409', 'survey_incomplete', { code: 'survey_incomplete', missing_survey_sections: ['bills'], survey_unsigned: ['associate'] }))
    const user = userEvent.setup()
    render(<SurveyPanel onboardingId={12} role="admin" />)
    await user.click(screen.getByRole('radio', { name: 'Feasible' }))
    await user.click(screen.getByRole('button', { name: 'Record review' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const msg = await screen.findByTestId('review-error')
    expect(msg).toHaveTextContent(/incomplete or unsigned/)
    expect(msg).toHaveTextContent(/Missing: bills/)
    expect(msg).toHaveTextContent(/Unsigned: associate/)
    expect(msg.textContent).not.toMatch(/object Object/)
  })
})

describe('SurveyPanel — report', () => {
  it('cannot generate before a review exists', () => {
    render(<SurveyPanel onboardingId={12} role="engineer" />)
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument()
  })

  it('fetches a fresh signed link on every click and opens it', async () => {
    status.mockReturnValue(ok(STATUS_FEASIBLE))
    reportLink.mockResolvedValue({ url: 'https://files.example/r.pdf', expires_at: 'x', filename: 'r.pdf', generated_at: 'x' })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()
    render(<SurveyPanel onboardingId={12} role="sales" />)
    expect(screen.queryByRole('button', { name: /generate|regenerate/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Download report' }))
    await user.click(screen.getByRole('button', { name: 'Download report' }))
    await waitFor(() => expect(reportLink).toHaveBeenCalledTimes(2))
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('maps 503 storage_not_configured and 404 report_not_generated to plain messages', async () => {
    status.mockReturnValue(ok(STATUS_FEASIBLE))
    vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()
    render(<SurveyPanel onboardingId={12} role="admin" />)
    reportLink.mockRejectedValueOnce(new ApiError(503, 'x', 'x', { code: 'storage_not_configured' }))
    await user.click(screen.getByRole('button', { name: 'Download report' }))
    expect(await screen.findByTestId('report-error')).toHaveTextContent(/storage is not configured/i)
    reportLink.mockRejectedValueOnce(new ApiError(404, 'x', 'x', { code: 'report_not_generated' }))
    await user.click(screen.getByRole('button', { name: 'Download report' }))
    await waitFor(() => expect(screen.getByTestId('report-error')).toHaveTextContent(/No report has been generated/))
  })

  it('regenerate is offered once a report exists', () => {
    status.mockReturnValue(ok(STATUS_FEASIBLE))
    render(<SurveyPanel onboardingId={12} role="engineer" />)
    expect(screen.getByRole('button', { name: 'Regenerate report' })).toBeEnabled()
  })
})
