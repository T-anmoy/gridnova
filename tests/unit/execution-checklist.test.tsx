import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExecutionChecklist from '@/components/associate/ExecutionChecklist'
import { ApiError } from '@/lib/dashboard/api-error'
import { describeMissing } from '@/lib/associate/execution-labels'
import { en, withI18n } from './helpers/i18n'
import type { ExecutionStageStatus, ExecutionStatus, StageSubmission } from '@/lib/associate/execution-types'
import type { Register } from '@/lib/associate/register-types'

const state: { data?: ExecutionStatus; error?: unknown; isLoading?: boolean } = {}
const refetch = vi.fn()
const submitMutate = vi.fn()
const uploadMutate = vi.fn()
vi.mock('@/lib/associate/execution-api-client', () => ({
  useExecution: () => ({ ...state, refetch }),
  useSubmitExecutionStage: () => ({ mutateAsync: submitMutate, isPending: false }),
  useUploadExecutionFile: () => ({ mutateAsync: uploadMutate }),
}))

// The entry form talks to the associate register endpoints; this file is about the checklist.
vi.mock('@/lib/associate/register-api-client', () => ({
  useAssociateCreateUnit: () => ({ mutateAsync: vi.fn() }),
  useAssociateBulkCreateUnits: () => ({ mutateAsync: vi.fn() }),
  useAssociateUpdateUnit: () => ({ mutateAsync: vi.fn() }),
  useAssociateVoidUnit: () => ({ mutateAsync: vi.fn() }),
  checkAssociateSerial: vi.fn(),
  useAssociateCatalogue: () => ({ items: [], isLoading: false, error: undefined, rateLimited: false, refetch: vi.fn() }),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))

const copy = en.associates.portal.execution
const photosCopy = en.associates.portal.wizard.photos

const stage = (over: Partial<ExecutionStageStatus> = {}): ExecutionStageStatus => ({
  stage: 'inspection_net_meter',
  label: 'Inspection & net meter',
  recorded: false,
  recorded_at: null,
  recorded_by: null,
  via: null,
  submission: null,
  evidence_required: { text: ['net_meter_serial'], documents: ['inspection_report'], optional_documents: ['net_meter_report'], photos: [], register_verified: false },
  blockers: [],
  ...over,
})

const submission = (over: Partial<StageSubmission> = {}): StageSubmission => ({
  submission_id: 7,
  onboarding_id: 5,
  stage: 'inspection_net_meter',
  stage_label: 'Inspection & net meter',
  status: 'pending',
  submitted_by: 'GNA-1',
  submitted_at: '2026-03-01T10:00:00Z',
  evidence: { text: { net_meter_serial: 'NM-100' }, note: null, documents: [], photos: [], register_verified_at: null },
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  ...over,
})

function status(over: Partial<ExecutionStatus> = {}): ExecutionStatus {
  return {
    onboarding_id: 5,
    project_id: 9,
    execution_mode: 'associate',
    started_at: '2026-02-01T00:00:00Z',
    register_verified_at: null,
    current_stage: 'inspection_net_meter',
    next_stage: 'inspection_net_meter',
    next_stage_is_execution: true,
    aging: { days_in_stage: 2, stuck_threshold_days: 21, is_stuck: false },
    pending_submission: null,
    stages: [stage({ stage: 'feasibility_submitted', label: 'Feasibility submitted', recorded: true }), stage()],
    photo_slots: [],
    document_types: [],
    files: { photos: {}, documents: {} },
    flags: [],
    can_submit: true,
    ...over,
  }
}

function show() {
  return render(withI18n(<ExecutionChecklist onboardingId={5} portalBase="/associates/portal" copy={copy} photosCopy={photosCopy} />))
}

beforeEach(() => {
  localStorage.clear()
  state.data = status()
  state.error = undefined
  state.isLoading = false
  submitMutate.mockReset()
  uploadMutate.mockReset()
  refetch.mockReset()
})

describe('ExecutionChecklist — who can act', () => {
  it('grid_nova mode is a read-only status view that explains Grid Nova is doing the work', () => {
    state.data = status({ execution_mode: 'grid_nova', can_submit: false })
    show()
    expect(screen.getByTestId('read-only')).toHaveTextContent(copy.gridNova)
    expect(screen.queryByRole('button', { name: copy.submit })).toBeNull()
  })

  it('a viewer who cannot submit (e.g. a Preferred Associate looking at a downline customer) sees a read-only view', () => {
    state.data = status({ can_submit: false })
    show()
    expect(screen.getByTestId('read-only')).toHaveTextContent(copy.readOnly)
    expect(screen.queryByRole('button', { name: copy.submit })).toBeNull()
  })
})

describe('ExecutionChecklist — submit, pending, rejected, resubmit', () => {
  it('renders the evidence from the response (not a fixed list) and keeps Submit disabled until it is complete', async () => {
    const user = userEvent.setup()
    show()
    expect(screen.getByLabelText(/Net meter serial number/)).toBeInTheDocument()
    expect(screen.getByText('Inspection report')).toBeInTheDocument()
    expect(screen.getByText('Net meter report')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.submit })).toBeDisabled()
    await user.type(screen.getByLabelText(/Net meter serial number/), 'NM-100')
    expect(screen.getByRole('button', { name: copy.submit })).toBeDisabled() // required document still missing
  })

  it('submits the typed references once the required document is on file, then shows the confirmation', async () => {
    state.data = status({ files: { photos: {}, documents: { inspection_report: { file_ref: 'f1', filename: 'report.pdf', received_at: '2026-03-01T00:00:00Z', uploaded_by: 'GNA-1' } } } })
    submitMutate.mockResolvedValue(submission())
    const user = userEvent.setup()
    show()
    await user.type(screen.getByLabelText(/Net meter serial number/), '  NM-100 ')
    await user.click(screen.getByRole('button', { name: copy.submit }))
    expect(submitMutate).toHaveBeenCalledWith({ stage: 'inspection_net_meter', text: { net_meter_serial: 'NM-100' } })
    expect(await screen.findByText(copy.submitted)).toBeInTheDocument()
  })

  it('a pending submission shows "Waiting for Grid Nova to verify" and no form', () => {
    state.data = status({ pending_submission: submission(), stages: [stage({ submission: submission() })] })
    show()
    expect(screen.getByText(copy.pendingTitle)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: copy.submit })).toBeNull()
  })

  it('a rejected submission shows the reviewer note prominently, prefills the form, and can be resubmitted', async () => {
    const rejected = submission({ status: 'rejected', review_note: 'Serial photo is blurry', reviewed_at: '2026-03-02T00:00:00Z' })
    state.data = status({
      stages: [stage({ submission: rejected })],
      files: { photos: {}, documents: { inspection_report: { file_ref: 'f1', filename: 'report.pdf', received_at: '2026-03-01T00:00:00Z', uploaded_by: 'GNA-1' } } },
    })
    submitMutate.mockResolvedValue(submission())
    const user = userEvent.setup()
    show()
    expect(screen.getByTestId('review-note')).toHaveTextContent('Serial photo is blurry')
    expect(screen.getByText(copy.rejectedTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(/Net meter serial number/)).toHaveValue('NM-100')
    await user.click(screen.getByRole('button', { name: copy.submit }))
    expect(submitMutate).toHaveBeenCalledTimes(1)
  })
})

describe('ExecutionChecklist — typed answers are never lost', () => {
  it('keeps typed references across a remount, and drops them after a successful submit', async () => {
    state.data = status({ files: { photos: {}, documents: { inspection_report: { file_ref: 'f1', filename: 'r.pdf', received_at: '2026-03-01T00:00:00Z', uploaded_by: null } } } })
    submitMutate.mockResolvedValue(submission())
    const user = userEvent.setup()
    const first = show()
    await user.type(screen.getByLabelText(/Net meter serial number/), 'NM-KEEP')
    first.unmount()
    const second = show()
    expect(screen.getByLabelText(/Net meter serial number/)).toHaveValue('NM-KEEP')
    await user.click(screen.getByRole('button', { name: copy.submit }))
    await screen.findByText(copy.submitted)
    second.unmount()
    show()
    expect(screen.getByLabelText(/Net meter serial number/)).toHaveValue('')
  })
})

describe('ExecutionChecklist — blockers, errors and labels', () => {
  it('shows a payment_gate blocker as a translated message without any amount', () => {
    state.data = status({ stages: [stage({ blockers: [{ code: 'payment_gate', message: 'server text' }] })] })
    show()
    expect(screen.getByText(copy.blockers.payment_gate)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/₹|Rs\.?\s*\d/)
  })

  it('maps evidence_missing entries to friendly labels, never raw keys', async () => {
    state.data = status({ files: { photos: {}, documents: { inspection_report: { file_ref: 'f1', filename: 'r.pdf', received_at: '2026-03-01T00:00:00Z', uploaded_by: null } } } })
    submitMutate.mockRejectedValue(
      new ApiError(422, 'x', 'Evidence missing', { code: 'evidence_missing', missing: ['text:net_meter_serial', 'document:inspection_report', 'photo:earthing', 'register:verified'] })
    )
    const user = userEvent.setup()
    show()
    await user.type(screen.getByLabelText(/Net meter serial number/), 'X')
    await user.click(screen.getByRole('button', { name: copy.submit }))
    const list = await screen.findByTestId('missing-list')
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Enter: Net meter serial number', 'Upload: Inspection report', 'Add a photo: Earthing', 'The serial numbers must be verified first'])
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors.evidence_missing)
  })

  it('an unknown evidence key from a newer backend gets a readable label', () => {
    expect(describeMissing('document:roof_survey_form', { ...copy })).toBe('Upload: Roof survey form')
    expect(describeMissing('text:new_ref', { ...copy })).toBe('Enter: New ref')
  })

  it('every photo slot offers both "Take photo" and "Choose from phone"', () => {
    state.data = status({ stages: [stage({ evidence_required: { text: [], documents: [], optional_documents: [], photos: ['earthing', 'array_installed'], register_verified: false } })] })
    show()
    expect(screen.getAllByRole('button', { name: photosCopy.captureButton })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: en.photoSlot.galleryButton })).toHaveLength(2)
  })

  it('shows the register requirement and its state', () => {
    state.data = status({ stages: [stage({ evidence_required: { text: [], documents: [], optional_documents: [], photos: [], register_verified: true } })] })
    show()
    expect(screen.getByText(new RegExp(copy.registerNotVerified))).toBeInTheDocument()
  })
})

describe('ExecutionChecklist — serial register (entry for the owner until verified)', () => {
  const register: Register = {
    verified_at: null,
    verified_by: null,
    units: [{ unit_id: 1, category: 'module' as const, serial_number: 'SN-0001', serial_normalized: 'SN-0001', equipment: null, rating_wp: '550.00', rating_kw: null, is_dcr: true, warranty_start: null, warranty_end: null, status: 'entered' as const, created_by: 'ops', created_at: '2026-03-01T00:00:00Z', verified_by: null, verified_at: null, void_reason: null }],
    totals: { modules: 1, inverters: 0, other: 0, inverter_kw: '0.00' },
    capacity: { installed_module_kw: '0.55', requested_kw: '3.00', tolerance_percent: 10, mismatch: false },
    dcr: { pm_surya_ghar: false, mismatch: false, override: null },
    flags: [],
  }

  it('offers entry and edit/remove to the owner before verification, and shows the waiting chip', () => {
    state.data = status({ register })
    show()
    expect(screen.getByTestId('register-readonly')).toHaveTextContent('SN-0001')
    expect(screen.getByTestId('register-entry')).toBeInTheDocument()
    expect(screen.getByTestId('waiting-match-chip')).toHaveTextContent(copy.register.entry.waiting)
    expect(screen.getByRole('button', { name: copy.register.entry.edit })).toBeInTheDocument()
  })

  it('is read-only for a territory reader (can_submit false)', () => {
    state.data = status({ register, can_submit: false })
    show()
    expect(screen.queryByTestId('register-entry')).toBeNull()
    expect(screen.queryByRole('button', { name: copy.register.entry.edit })).toBeNull()
  })

  it('is read-only after Grid Nova verifies the register, with the verified badge and a locked note', () => {
    state.data = status({ register: { ...register, verified_at: '2026-03-05T00:00:00Z', verified_by: 'ops' } })
    show()
    expect(screen.getByTestId('register-badge')).toHaveTextContent(copy.register.verifiedBadge)
    expect(screen.queryByTestId('register-entry')).toBeNull()
    expect(screen.queryByRole('button', { name: copy.register.entry.edit })).toBeNull()
    expect(screen.getByTestId('register-locked-note')).toBeInTheDocument()
  })

  it('omits the section when the response carries no register', () => {
    show()
    expect(screen.queryByTestId('register-readonly')).toBeNull()
  })
})

describe('ExecutionChecklist — load states', () => {
  it('shows a skeleton while loading', () => {
    state.data = undefined
    state.isLoading = true
    show()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('explains that installation has not started on 409 execution_not_started', () => {
    state.data = undefined
    state.error = new ApiError(409, 'x', 'not started', { code: 'execution_not_started' })
    show()
    expect(screen.getByText(copy.notStarted)).toBeInTheDocument()
  })

  it('shows an error with Retry for other failures', async () => {
    state.data = undefined
    state.error = new ApiError(500, 'x', 'boom')
    show()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('shows the completion state when no execution step remains', () => {
    state.data = status({ next_stage: null, next_stage_is_execution: false, current_stage: 'handover_complete', stages: [stage({ stage: 'handover_complete', label: 'Handover', recorded: true })] })
    show()
    expect(screen.getByText(copy.complete)).toBeInTheDocument()
  })
})
