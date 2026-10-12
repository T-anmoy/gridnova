import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/dashboard/api-error'
import { NAV_ITEMS, overdueSurveyCount, queueBadgeCount, visibleNavItems } from '@/lib/dashboard/nav'
import { REVIEW_QUEUE, STAFF_CORRECTION } from './fixtures/survey-review-contract'
import type { Role } from '@/lib/dashboard/types'

const replace = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/dashboard/survey-reviews',
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

let role: Role | undefined = 'engineer'
vi.mock('@/lib/dashboard/use-staff-role', () => ({ useStaffRole: () => ({ role, isLoaded: true }) }))
vi.mock('@/lib/dashboard/api-client', () => ({ useEmployeeMe: () => ({ data: { id: 'emp-eng-1' } }) }))
vi.mock('@/lib/dashboard/onboarding-api-client', () => ({
  useStaffOnboarding: () => ({ data: { site_assessment: { roof_area_sqft: 800 } }, isLoading: false }),
}))

const reviewQueue = vi.fn()
const corrQueue = vi.fn()
const decide = vi.fn()
vi.mock('@/lib/dashboard/survey-review-api-client', () => ({
  useSurveyReviewQueue: (p: unknown) => reviewQueue(p),
  useSurveyCorrectionQueue: (p: unknown) => corrQueue(p),
  useDecideSurveyCorrection: () => ({ mutateAsync: decide, isPending: false }),
}))

import SurveyReviewsPage from '@/app/(internal)/dashboard/survey-reviews/page'
import SurveyCorrectionsPage from '@/app/(internal)/dashboard/survey-corrections/page'
import { toast } from 'sonner'

const ok = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })

beforeEach(() => {
  vi.clearAllMocks()
  search = ''
  role = 'engineer'
  reviewQueue.mockReturnValue(ok(REVIEW_QUEUE))
  corrQueue.mockReturnValue(ok({ items: [STAFF_CORRECTION], page: 1, page_size: 25, total: 1 }))
  decide.mockResolvedValue({ correction: STAFF_CORRECTION, flagged_proposal_ids: [31] })
})

describe('nav badges and role gating', () => {
  it('counts only `awaiting` for survey reviews — overdue is inside awaiting, so adding both would double count', () => {
    const q = { survey_reviews: { awaiting: 5, overdue: 2 }, survey_corrections: { pending: 3 } }
    expect(queueBadgeCount('survey_reviews', q)).toBe(5)
    expect(overdueSurveyCount(q)).toBe(2)
    expect(queueBadgeCount('survey_corrections', q)).toBe(3)
  })

  it('is zero when the role gets no survey counts (they are admin/engineer only)', () => {
    expect(queueBadgeCount('survey_reviews', { execution: { pending_stage_verifications: 1, stuck_projects: 0, dcr_mismatch: 0 } })).toBe(0)
    expect(queueBadgeCount('survey_corrections', undefined)).toBe(0)
  })

  it('execution and payments still sum every counter', () => {
    expect(queueBadgeCount('execution', { execution: { pending_stage_verifications: 1, stuck_projects: 2, dcr_mismatch: 3 } })).toBe(6)
  })

  it.each([
    ['admin', true], ['management', true], ['sales', true], ['engineer', true], ['operations', false], ['accounts', false],
  ] as const)('%s sees the survey queues: %s', (r, expected) => {
    const labels = visibleNavItems(r as Role).map((i) => i.label)
    expect(labels.includes('Survey reviews')).toBe(expected)
    expect(labels.includes('Survey corrections')).toBe(expected)
  })

  it('the new hrefs are unique and under /dashboard', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

describe('Survey reviews queue', () => {
  it('rows are real links to the customer, with hours waiting and an overdue badge', () => {
    render(<SurveyReviewsPage />)
    const row = screen.getByTestId('survey-review-row')
    expect(within(row).getByRole('link', { name: 'Asha Roy' })).toHaveAttribute('href', '/dashboard/onboardings/12')
    expect(row).toHaveAttribute('role', 'link')
    expect(row).toHaveAttribute('tabindex', '0')
    expect(within(row).getByText('60 h')).toBeInTheDocument()
    expect(within(row).getByText('Overdue')).toBeInTheDocument()
  })

  it('the tab and page live in the URL and are sent to the server', async () => {
    search = 'state=reviewed&page=2'
    const user = userEvent.setup()
    render(<SurveyReviewsPage />)
    expect(reviewQueue).toHaveBeenCalledWith({ state: 'reviewed', page: 2, page_size: 25 })
    expect(screen.getByRole('tab', { name: 'Reviewed' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Overdue' }))
    expect(replace).toHaveBeenCalledWith('/dashboard/survey-reviews?state=overdue', { scroll: false })
  })

  it('an unknown state falls back to awaiting', () => {
    search = 'state=bogus'
    render(<SurveyReviewsPage />)
    expect(reviewQueue).toHaveBeenCalledWith({ state: 'awaiting', page: 1, page_size: 25 })
  })

  it('operations is shown a no-access notice, not a 403 error page', () => {
    role = 'operations'
    render(<SurveyReviewsPage />)
    expect(screen.getByTestId('no-access')).toBeInTheDocument()
  })
})

describe('Survey corrections queue', () => {
  it('shows each change field by field: now → requested, with the reason and requester', () => {
    role = 'admin'
    render(<SurveyCorrectionsPage />)
    const diff = screen.getByTestId('diff-roof_area_sqft')
    expect(within(diff).getByTestId('diff-before')).toHaveTextContent('800')
    expect(within(diff).getByTestId('diff-after')).toHaveTextContent('950')
    expect(screen.getByText('Measured the terrace again')).toBeInTheDocument()
    expect(screen.getByText(/associate:GNA-WB-26-00001/)).toBeInTheDocument()
  })

  it('an engineer cannot read the customer record, so no "now" value is invented', () => {
    render(<SurveyCorrectionsPage />)
    expect(screen.getByTestId('diff-before')).toHaveTextContent('Not shown for your role')
  })

  it('sales and management read the queue but get no Apply / Reject', () => {
    for (const r of ['sales', 'management'] as const) {
      role = r
      const { unmount } = render(<SurveyCorrectionsPage />)
      expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('the requester never sees Apply or Reject on their own request', () => {
    corrQueue.mockReturnValue(ok({ items: [{ ...STAFF_CORRECTION, requested_by: 'emp-eng-1' }], page: 1, page_size: 25, total: 1 }))
    render(<SurveyCorrectionsPage />)
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
    expect(screen.getByText(/a colleague has to decide/)).toBeInTheDocument()
  })

  it('Reject needs a note; the note is sent; nothing is sent without it', async () => {
    const user = userEvent.setup()
    render(<SurveyCorrectionsPage />)
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject correction' }))
    const note = within(screen.getByRole('dialog')).getByLabelText('Note (required)')
    expect(note).toHaveAttribute('aria-invalid', 'true')
    expect(decide).not.toHaveBeenCalled()
    await user.type(note, 'Photos do not match')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject correction' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith({ id: 4, decision: 'reject', note: 'Photos do not match' }))
  })

  it('Apply confirms first and reports the flagged proposals', async () => {
    const user = userEvent.setup()
    render(<SurveyCorrectionsPage />)
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(decide).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply correction' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith({ id: 4, decision: 'apply', note: '' }))
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining('1 proposal flagged'))
  })

  it('maps the 403 segregation_of_duties and 409 correction_not_pending errors to plain sentences', async () => {
    const user = userEvent.setup()
    render(<SurveyCorrectionsPage />)
    decide.mockRejectedValueOnce(new ApiError(403, 'x', 'x', { code: 'segregation_of_duties' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply correction' }))
    expect(await screen.findByTestId('decide-error')).toHaveTextContent(/cannot decide a request you made/)
    decide.mockRejectedValueOnce(new ApiError(409, 'x', 'x', { code: 'correction_not_pending' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply correction' }))
    await waitFor(() => expect(screen.getByTestId('decide-error')).toHaveTextContent(/already decided/))
  })

  it('the status tab lives in the URL', async () => {
    search = 'status=applied'
    render(<SurveyCorrectionsPage />)
    expect(corrQueue).toHaveBeenCalledWith({ status: 'applied', page: 1, page_size: 25 })
  })
})
