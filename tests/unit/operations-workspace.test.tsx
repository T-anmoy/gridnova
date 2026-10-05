import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExecutionDetailPanel from '@/components/dashboard/ExecutionDetailPanel'
import OperationsPage from '@/app/(internal)/dashboard/operations/page'
import { ApiError } from '@/lib/dashboard/api-error'
import { withI18n } from './helpers/i18n'
import type { ExecutionStageStatus, StageSubmission } from '@/lib/associate/execution-types'
import type { ExecutionQueueItem, StaffExecutionDetail } from '@/lib/dashboard/execution-types'

const h = vi.hoisted(() => ({
  detail: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  queue: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  queueParams: [] as unknown[],
  queues: { data: undefined as unknown },
  verify: vi.fn(),
  reject: vi.fn(),
  record: vi.fn(),
  mode: vi.fn(),
  dcr: vi.fn(),
  upload: vi.fn(),
  refetch: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/lib/dashboard/execution-api-client', () => ({
  useStaffExecution: () => ({ ...h.detail, refetch: h.refetch }),
  useExecutionQueue: (p: unknown) => {
    h.queueParams.push(p)
    return { ...h.queue, refetch: h.refetch }
  },
  useWorkQueues: () => h.queues,
  useVerifySubmission: () => ({ mutateAsync: h.verify }),
  useRejectSubmission: () => ({ mutateAsync: h.reject }),
  useRecordStage: () => ({ mutateAsync: h.record }),
  useSwitchExecutionMode: () => ({ mutateAsync: h.mode }),
  useDcrOverride: () => ({ mutateAsync: h.dcr }),
  useUploadStaffExecutionFile: () => ({ mutateAsync: h.upload }),
  fetchStaffExecutionFileLink: vi.fn(),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }), useClerk: () => ({ signOut: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))

const stage = (over: Partial<ExecutionStageStatus> = {}): ExecutionStageStatus => ({
  stage: 'inspection_net_meter',
  label: 'Inspection & net meter',
  recorded: false,
  recorded_at: null,
  recorded_by: null,
  via: null,
  submission: null,
  evidence_required: { text: ['net_meter_serial'], documents: [], optional_documents: [], photos: [], register_verified: false },
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
  evidence: {
    text: { net_meter_serial: 'NM-100' },
    note: null,
    documents: { inspection_report: { file_ref: 'f-doc', filename: 'report.pdf', received_at: '2026-03-01T00:00:00Z', uploaded_by: 'GNA-1' } },
    photos: {
      earthing: { file_ref: 'f-ph', filename: 'earth.jpg', received_at: '2026-03-01T00:00:00Z', uploaded_by: 'GNA-1', capture_method: 'gallery', location_verified: false, flags: ['gallery_upload', 'duplicate_photo'] },
    },
    register_verified_at: null,
  },
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  ...over,
})

function detail(over: Partial<StaffExecutionDetail> = {}): StaffExecutionDetail {
  return {
    onboarding_id: 5,
    project_id: 9,
    execution_mode: 'associate',
    started_at: '2026-02-01T00:00:00Z',
    register_verified_at: null,
    current_stage: 'inspection_net_meter',
    next_stage: 'inspection_net_meter',
    next_stage_is_execution: true,
    aging: { days_in_stage: 30, stuck_threshold_days: 21, is_stuck: true },
    pending_submission: null,
    stages: [stage({ stage: 'feasibility_submitted', label: 'Feasibility submitted', recorded: true, recorded_by: 'ops@x', via: 'admin_override', recorded_at: '2026-02-05T00:00:00Z' }), stage()],
    photo_slots: [],
    document_types: [],
    files: { photos: {}, documents: {} },
    flags: ['dcr_mismatch'],
    customer: {
      name: 'Bikash Das',
      mobile: '9800000000',
      project_reference_id: 'GN-2026-1',
      site: { address: '12 Lake Road', pin_code: '700001', territory: 'Kolkata', latitude: null, longitude: null },
      associate: { associate_id: 'GNA-1', full_name: 'Asha Roy', associate_type: 'associate', mobile: '9811111111' },
    },
    can_verify: true,
    can_record: false,
    ...over,
  }
}

function showPanel(role: 'admin' | 'operations' | 'engineer' = 'operations') {
  return render(withI18n(<ExecutionDetailPanel onboardingId={5} role={role} />))
}

beforeEach(() => {
  h.detail = { data: detail() }
  h.queue = {}
  h.queueParams.length = 0
  h.queues = { data: undefined }
  for (const fn of [h.verify, h.reject, h.record, h.mode, h.dcr, h.upload, h.refetch, h.push]) fn.mockReset()
})

describe('ExecutionDetailPanel — stalls, flags and stage history', () => {
  it('marks a stuck project with days in stage, shows flags, mode and stage provenance (incl. admin override)', () => {
    showPanel()
    expect(screen.getByTestId('stuck-badge')).toHaveTextContent('Stuck · 30 days')
    expect(screen.getByTestId('flag-dcr_mismatch')).toHaveTextContent('DCR mismatch')
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Associate executes')
    expect(within(screen.getByTestId('stage-feasibility_submitted')).getByText('Admin override')).toBeInTheDocument()
  })

  it('never shows any monetary field to Operations', () => {
    const { container } = showPanel('operations')
    expect(container.textContent).not.toMatch(/₹|\bINR\b|\bRs\.?\s?\d|payment|invoice|receipt|balance/i)
    expect(container.querySelector('a[href*="payment"]')).toBeNull()
  })
})

describe('ExecutionDetailPanel — verify / reject', () => {
  beforeEach(() => {
    const sub = submission()
    h.detail = { data: detail({ pending_submission: sub, stages: [stage({ submission: sub })] }) }
  })

  it('shows the evidence (text, documents, photos) with staff-only photo flags', () => {
    showPanel()
    const viewer = screen.getByTestId('evidence-viewer')
    expect(viewer).toHaveTextContent('NM-100')
    expect(viewer).toHaveTextContent('Inspection report')
    expect(within(viewer).getAllByRole('button', { name: /view/i })).toHaveLength(2)
    expect(within(viewer).getByTestId('photo-flags')).toHaveTextContent('Gallery upload')
    expect(within(viewer).getByTestId('photo-flags')).toHaveTextContent('Duplicate photo')
  })

  it('verifies with an optional note', async () => {
    h.verify.mockResolvedValue(detail())
    const user = userEvent.setup()
    showPanel()
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verify' }))
    expect(h.verify).toHaveBeenCalledWith({ submissionId: 7, note: undefined })
  })

  it('rejecting needs a note, and sends it', async () => {
    h.reject.mockResolvedValue(detail())
    const user = userEvent.setup()
    showPanel()
    await user.click(screen.getByRole('button', { name: 'Reject with note' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Reject' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Note for the associate/), 'Photo is blurry')
    await user.click(confirm)
    expect(h.reject).toHaveBeenCalledWith({ submissionId: 7, note: 'Photo is blurry' })
  })

  it('explains payment_gate and dcr_mismatch refusals in plain words and keeps the dialog open', async () => {
    h.verify.mockRejectedValue(new ApiError(409, 'x', 'blocked', { code: 'payment_gate' }))
    const user = userEvent.setup()
    showPanel()
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verify' }))
    const alert = await within(screen.getByRole('dialog')).findByRole('alert')
    expect(alert).toHaveTextContent('Earlier customer payments are not fully verified yet')
    expect(alert.textContent).not.toMatch(/₹/)
  })

  it('hides Verify/Reject when the viewer cannot verify', () => {
    h.detail = { data: detail({ can_verify: false, pending_submission: submission(), stages: [stage({ submission: submission() })] }) }
    showPanel('engineer')
    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull()
  })
})

describe('ExecutionDetailPanel — recording, admin override and mode switch', () => {
  it('Operations cannot record on an associate-mode project: only a hint is shown', () => {
    h.detail = { data: detail({ can_record: true }) }
    showPanel('operations')
    expect(screen.getByTestId('associate-doing-it')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Record/ })).toBeNull()
  })

  it('an Admin records on an associate-mode project only with an override reason', async () => {
    h.detail = { data: detail({ can_record: true }) }
    h.record.mockResolvedValue(detail())
    const user = userEvent.setup()
    showPanel('admin')
    await user.type(screen.getByLabelText(/Net meter serial number/), 'NM-9')
    const button = screen.getByRole('button', { name: 'Record with admin override' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText(/Override reason/), 'Associate unreachable')
    expect(button).toBeEnabled()
    await user.click(button)
    expect(h.record).toHaveBeenCalledWith({ stage: 'inspection_net_meter', text: { net_meter_serial: 'NM-9' }, admin_override_reason: 'Associate unreachable' })
  })

  it('in Grid Nova mode Operations records directly, with no override reason', async () => {
    h.detail = { data: detail({ execution_mode: 'grid_nova', can_record: true }) }
    h.record.mockResolvedValue(detail())
    const user = userEvent.setup()
    showPanel('operations')
    expect(screen.queryByLabelText(/Override reason/)).toBeNull()
    await user.type(screen.getByLabelText(/Net meter serial number/), 'NM-9')
    await user.click(screen.getByRole('button', { name: 'Record stage' }))
    expect(h.record).toHaveBeenCalledWith({ stage: 'inspection_net_meter', text: { net_meter_serial: 'NM-9' } })
  })

  it('only an Admin is offered the mode switch, and it needs a reason', async () => {
    h.mode.mockResolvedValue(detail({ execution_mode: 'grid_nova' }))
    const user = userEvent.setup()
    const { unmount } = showPanel('operations')
    expect(screen.queryByRole('button', { name: /Switch to Grid Nova/ })).toBeNull()
    unmount()
    showPanel('admin')
    await user.click(screen.getByRole('button', { name: /Switch to Grid Nova mode/ }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Switch mode' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Associate left')
    await user.click(confirm)
    expect(h.mode).toHaveBeenCalledWith({ reason: 'Associate left' })
  })

  it('shows the DCR blocker; only an Admin gets the override-with-reason action', async () => {
    const blocked = stage({ stage: 'subsidy_claimed', label: 'Subsidy claimed', blockers: [{ code: 'dcr_mismatch', message: 'x' }] })
    h.detail = { data: detail({ stages: [blocked], current_stage: 'subsidy_claimed', next_stage: 'subsidy_claimed' }) }
    h.dcr.mockResolvedValue(detail())
    const { unmount } = showPanel('operations')
    expect(screen.getByTestId('blocker-dcr_mismatch')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record DCR override' })).toBeNull()
    unmount()
    const user = userEvent.setup()
    showPanel('admin')
    await user.click(screen.getByRole('button', { name: 'Record DCR override' }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Reason/), 'Approved by client')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Record override' }))
    expect(h.dcr).toHaveBeenCalledWith({ reason: 'Approved by client' })
  })

  it('shows a payment_gate blocker as a message without amounts', () => {
    h.detail = { data: detail({ stages: [stage({ blockers: [{ code: 'payment_gate', message: 'server text' }] })] }) }
    const { container } = showPanel()
    expect(screen.getByTestId('blocker-payment_gate')).toHaveTextContent('On hold: earlier customer payments are not fully verified.')
    expect(container.textContent).not.toMatch(/₹/)
  })
})

describe('ExecutionDetailPanel — admin override when the associate’s evidence is missing', () => {
  it('says so plainly, lists the missing items, and offers the Grid Nova mode switch', async () => {
    h.detail = { data: detail({ can_record: true }) }
    h.record.mockRejectedValue(new ApiError(422, 'x', 'missing', { code: 'evidence_missing', missing: ['text:net_meter_serial', 'photo:earthing'] }))
    h.mode.mockResolvedValue(detail({ execution_mode: 'grid_nova' }))
    const user = userEvent.setup()
    showPanel('admin')
    await user.type(screen.getByLabelText(/Net meter serial number/), 'NM-9')
    await user.type(screen.getByLabelText(/Override reason/), 'Associate unreachable')
    await user.click(screen.getByRole('button', { name: 'Record with admin override' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The associate’s evidence for this stage is missing')
    const items = within(screen.getByTestId('missing-list')).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Enter: Net meter serial number', 'Add a photo: Earthing'])
    await user.click(within(alert).getByRole('button', { name: 'Switch this project to Grid Nova mode' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Reason/), 'Evidence missing')
    await user.click(within(dialog).getByRole('button', { name: 'Switch mode' }))
    expect(h.mode).toHaveBeenCalledWith({ reason: 'Evidence missing' })
  })

  it('does not offer the switch for other failures', async () => {
    h.detail = { data: detail({ can_record: true }) }
    h.record.mockRejectedValue(new ApiError(409, 'x', 'order', { code: 'stage_out_of_order' }))
    const user = userEvent.setup()
    showPanel('admin')
    await user.type(screen.getByLabelText(/Net meter serial number/), 'NM-9')
    await user.type(screen.getByLabelText(/Override reason/), 'x')
    await user.click(screen.getByRole('button', { name: 'Record with admin override' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Switch this project to Grid Nova mode' })).toBeNull()
  })
})

describe('ExecutionDetailPanel — load states', () => {
  it('explains "not started" and "not available for this customer"', () => {
    h.detail = { error: new ApiError(409, 'x', 'n', { code: 'execution_not_started' }) }
    const { unmount } = showPanel()
    expect(screen.getByTestId('execution-unavailable')).toHaveTextContent('Installation has not started')
    unmount()
    h.detail = { error: new ApiError(404, 'x', 'nf') }
    showPanel()
    expect(screen.getByTestId('execution-unavailable')).toHaveTextContent('not available for this customer')
  })

  it('shows a skeleton and an error with Retry', async () => {
    h.detail = { isLoading: true }
    const { unmount, container } = showPanel()
    expect(container.querySelector('[class*="animate-pulse"]')).not.toBeNull()
    unmount()
    h.detail = { error: new ApiError(500, 'x', 'boom') }
    showPanel()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(h.refetch).toHaveBeenCalled()
  })
})

const item = (over: Partial<ExecutionQueueItem> = {}): ExecutionQueueItem => ({
  onboarding_id: 5,
  project_id: 9,
  project_reference_id: 'GN-1',
  customer_name: 'Bikash Das',
  execution_mode: 'associate',
  current_stage: 'installed',
  next_stage: 'installed',
  next_stage_label: 'Installed',
  days_in_stage: 12,
  stuck_threshold_days: 10,
  is_stuck: true,
  pending_submission: { submission_id: 7, stage: 'installed', submitted_at: '2026-03-01T00:00:00Z' },
  flags: ['dcr_mismatch'],
  needs_attention: true,
  attention_reasons: ['pending_verification', 'stuck', 'dcr_mismatch'],
  started_at: '2026-02-01T00:00:00Z',
  ...over,
})

describe('Operations queue page', () => {
  it('marks stalled rows visibly (stuck, awaiting verification, DCR) and links to the project', async () => {
    h.queue = { data: { items: [item()], page: 1, page_size: 25, total: 1 } }
    h.queues = { data: { execution: { pending_stage_verifications: 3, stuck_projects: 2, dcr_mismatch: 1 } } }
    render(withI18n(<OperationsPage />))
    const row = screen.getByTestId('queue-row')
    expect(within(row).getByTestId('row-stuck')).toBeInTheDocument()
    expect(row).toHaveTextContent('Awaiting verification')
    expect(row).toHaveTextContent('DCR mismatch')
    expect(screen.getByTestId('queue-summary')).toHaveTextContent('3')
    await userEvent.setup().click(row)
    expect(h.push).toHaveBeenCalledWith('/dashboard/operations/5')
  })

  it('has a one-click needs-attention filter that changes the request', async () => {
    h.queue = { data: { items: [], page: 1, page_size: 25, total: 0 } }
    render(withI18n(<OperationsPage />))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Needs attention' }))
    await waitFor(() => expect(h.queueParams.at(-1)).toMatchObject({ needs_attention: true, page: 1 }))
    expect(screen.getByText('No projects match.')).toBeInTheDocument()
  })

  it('shows error with Retry', async () => {
    h.queue = { error: new ApiError(500, 'x', 'boom') }
    render(withI18n(<OperationsPage />))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(h.refetch).toHaveBeenCalled()
  })

  it('page contains no monetary text', () => {
    h.queue = { data: { items: [item()], page: 1, page_size: 25, total: 1 } }
    const { container } = render(withI18n(<OperationsPage />))
    expect(container.textContent).not.toMatch(/₹|payment|invoice|receipt|balance/i)
  })
})
