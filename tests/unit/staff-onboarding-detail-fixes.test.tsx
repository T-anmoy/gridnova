import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/dashboard/api-error'
import type { FormalProposalReadResponse, Onboarding, ProgressResponse } from '@/lib/associate/onboarding-types'
import type { AgreementResponse } from '@/lib/dashboard/onboarding-types'
import { typeDateField } from './helpers/date-field'

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '77' }) }))
vi.mock('@/lib/dashboard/use-staff-role', () => ({ useStaffRole: () => ({ role: 'admin', isLoaded: true }) }))
vi.mock('@/components/dashboard/SurveyPanel', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUseStaffOnboarding = vi.fn()
const mockUseStaffOnboardingProgress = vi.fn()
const mockUseVerificationCall = vi.fn()
const mockUseStaffOnboardingEstimates = vi.fn()
const mockUsePrepareFormalProposal = vi.fn()
const mockUseStaffOnboardingFormalProposal = vi.fn()
const mockUseStaffInPersonAcceptance = vi.fn()
const mockUseStaffOnboardingAgreement = vi.fn()
const mockUseGenerateAgreement = vi.fn()
const mockUseUploadStaffSignedAgreement = vi.fn()

vi.mock('@/lib/dashboard/onboarding-api-client', () => ({
  useStaffOnboarding: () => mockUseStaffOnboarding(),
  useStaffOnboardingProgress: () => mockUseStaffOnboardingProgress(),
  useVerificationCall: () => mockUseVerificationCall(),
  useStaffOnboardingEstimates: () => mockUseStaffOnboardingEstimates(),
  usePrepareFormalProposal: () => mockUsePrepareFormalProposal(),
  useStaffOnboardingFormalProposal: () => mockUseStaffOnboardingFormalProposal(),
  useStaffInPersonAcceptance: () => mockUseStaffInPersonAcceptance(),
  useStaffOnboardingAgreement: () => mockUseStaffOnboardingAgreement(),
  useGenerateAgreement: () => mockUseGenerateAgreement(),
  useUploadStaffSignedAgreement: () => mockUseUploadStaffSignedAgreement(),
  useCorrectSiteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

const ONBOARDING: Onboarding = {
  onboarding_id: 77,
  status: 'verified',
  lead_id: 9,
  project_reference_id: null,
  owner: { associate_id: 'GNA-1', full_name: 'Asha Roy', associate_type: 'associate' },
  customer: { name: 'Bikash Das', mobile: '9800000000', email: null },
  territory: { state: { lgd_code: 19, name: 'West Bengal' }, district: null, block: null },
  site_latitude: null,
  site_longitude: null,
  site_location: { present: false, confirmed: false, flags: ['location_missing'] },
  connection_in_customer_name: true,
  property_in_customer_name: true,
  customer_timeline: 'immediate',
  site_assessment: null,
  documents: [],
  photos: [],
  checklist: { required: ['electricity_bill'], present: ['electricity_bill'], missing: [] },
  notice: { version: 'v1', acknowledged_at: '2026-01-01T00:00:00Z', recorded_by: 'GNA-1' },
  verification: { completed: true, verified_at: '2026-01-02T00:00:00Z' },
  attribution: { locked: false, released_reason: null, under_review: false },
  score: null,
  formal_proposal_blocked: null,
  submitted_at: '2026-01-01T00:00:00Z',
  warnings: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  closed_reason: null,
}

const PROGRESS: ProgressResponse = { project_id: 1, current_stage: 'proposal_issued', next_stage: 'accepted', stages: [] }

beforeEach(() => {
  vi.clearAllMocks()
  mockUseStaffOnboarding.mockReturnValue({ data: ONBOARDING, isLoading: false, error: null, refetch: vi.fn() })
  mockUseStaffOnboardingProgress.mockReturnValue({ data: PROGRESS })
  mockUseVerificationCall.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUseStaffOnboardingEstimates.mockReturnValue({ data: [] })
  mockUsePrepareFormalProposal.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUseGenerateAgreement.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe('Staff formal-proposal panel — in-person acceptance gets proposal_id from the GET, and sends all 4 fields', () => {
  it('reads proposal_id from useStaffOnboardingFormalProposal, not from anywhere else, and submits it with the 3 typed fields', async () => {
    const fp: FormalProposalReadResponse = {
      prepared: true,
      proposal_id: 4242,
      version: 1,
      status: 'sent',
      total_value: 250000,
      approved_at: '2026-01-04T00:00:00Z',
      date_sent: '2026-01-05T00:00:00Z',
      accepted_at: null,
      ready_to_hand_over: false,
      pdf: null,
    }
    mockUseStaffOnboardingFormalProposal.mockReturnValue({ data: fp, isLoading: false })
    const acceptMutateAsync = vi.fn().mockResolvedValue({})
    mockUseStaffInPersonAcceptance.mockReturnValue({ mutateAsync: acceptMutateAsync, isPending: false })
    mockUseStaffOnboardingAgreement.mockReturnValue({ data: { links: {} } as AgreementResponse, isLoading: false })

    const { default: StaffOnboardingDetailPage } = await import('@/app/(internal)/dashboard/onboardings/[id]/page')
    const user = userEvent.setup()
    render(<StaffOnboardingDetailPage />)

    await user.click(screen.getByRole('button', { name: 'Record in-person acceptance' }))
    await typeDateField(user, 'Delivered on', '06012026')
    await user.type(screen.getByPlaceholderText('Note (required)'), 'Handed over at site')
    await user.type(screen.getByPlaceholderText('Reference (required)'), 'REF-100')
    await user.click(screen.getByRole('button', { name: 'Confirm acceptance' }))

    await waitFor(() => expect(acceptMutateAsync).toHaveBeenCalledTimes(1))
    expect(acceptMutateAsync).toHaveBeenCalledWith({
      id: 77,
      input: { proposal_id: 4242, delivered_on: '2026-01-06', note: 'Handed over at site', reference: 'REF-100' },
    })
  })
})

describe('Staff agreement section — signed-scan upload', () => {
  it('uploads file + stamp_paper_number + stamp_paper_date to the staff signed-agreement endpoint, and shows errors plainly', async () => {
    mockUseStaffOnboardingFormalProposal.mockReturnValue({ data: { prepared: false, missing_fields: [] }, isLoading: false })
    mockUseStaffOnboardingAgreement.mockReturnValue({
      data: { links: { agreement_pdf: { url: 'https://files/agreement.pdf', expires_at: 'x' } } } as AgreementResponse,
      isLoading: false,
    })
    const uploadMutateAsync = vi.fn().mockRejectedValue(new ApiError(422, 'API error 422', 'Please enter a valid stamp paper number.'))
    mockUseUploadStaffSignedAgreement.mockReturnValue({ mutateAsync: uploadMutateAsync, isPending: false })

    const { default: StaffOnboardingDetailPage } = await import('@/app/(internal)/dashboard/onboardings/[id]/page')
    const user = userEvent.setup()
    const { container } = render(<StaffOnboardingDetailPage />)

    // Regenerate is offered (not yet signed).
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['x'], 'signed.pdf', { type: 'application/pdf' }))
    await user.type(screen.getByPlaceholderText('Stamp paper number'), 'bad-number')
    await user.click(screen.getByRole('button', { name: 'Upload signed scan' }))

    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledTimes(1))
    expect(uploadMutateAsync.mock.calls[0][0]).toMatchObject({
      id: 77,
      input: { stamp_paper_number: 'bad-number' },
    })
    expect(await screen.findByText('Please enter a valid stamp paper number.')).toBeInTheDocument()
  })

  it('hides Regenerate once a signed scan exists, and shows the signed-scan link instead of the upload form', async () => {
    mockUseStaffOnboardingFormalProposal.mockReturnValue({ data: { prepared: false, missing_fields: [] }, isLoading: false })
    mockUseStaffOnboardingAgreement.mockReturnValue({
      data: {
        links: {
          agreement_pdf: { url: 'https://files/agreement.pdf', expires_at: 'x' },
          signed_scan: { url: 'https://files/signed.pdf', expires_at: 'x' },
        },
      } as AgreementResponse,
      isLoading: false,
    })
    mockUseUploadStaffSignedAgreement.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

    const { default: StaffOnboardingDetailPage } = await import('@/app/(internal)/dashboard/onboardings/[id]/page')
    render(<StaffOnboardingDetailPage />)

    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View signed scan' })).toHaveAttribute('href', 'https://files/signed.pdf')
    expect(screen.queryByRole('button', { name: 'Upload signed scan' })).not.toBeInTheDocument()
  })
})
