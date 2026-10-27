import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HandoverPanel from '@/components/dashboard/handover/HandoverPanel'
import WarrantyPanel from '@/components/dashboard/handover/WarrantyPanel'
import ProjectServiceRequests from '@/components/dashboard/handover/ProjectServiceRequests'
import ServiceRequestQueue from '@/components/dashboard/handover/ServiceRequestQueue'
import ServiceRequestDetail from '@/components/dashboard/handover/ServiceRequestDetail'
import ServiceRequestsPage from '@/app/(internal)/dashboard/service-requests/page'
import ExecutionDetailPanel from '@/components/dashboard/ExecutionDetailPanel'
import { ApiError } from '@/lib/dashboard/api-error'
import { NAV_ITEMS, overdueServiceRequestCount, queueBadgeCount, visibleNavItems } from '@/lib/dashboard/nav'
import type { Role } from '@/lib/dashboard/types'
import { navState } from './helpers/mock-navigation'
import { COMPLETE_PACK, GATE_422_BODY, HANDED_OVER_PACK, makePack, makeRequest } from './fixtures/handover-contract'
import { asRoles, permissionsFor } from './helpers/permissions-bridge'

const h = vi.hoisted(() => ({
  role: { role: 'operations' as string | undefined, isLoaded: true },
  me: { data: { id: 'EMP-OPS-1' } as { id: string } | undefined },
  employees: { data: undefined as unknown },
  pack: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  project: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  queue: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  detail: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  queueParams: vi.fn(),
  queues: { data: undefined as unknown },
  tickOrientation: vi.fn(),
  tickOm: vi.fn(),
  ack: vi.fn(),
  issue: vi.fn(),
  revoke: vi.fn(),
  regenerate: vi.fn(),
  pdfLink: vi.fn(),
  raise: vi.fn(),
  assign: vi.fn(),
  setStatus: vi.fn(),
  note: vi.fn(),
  photoLink: vi.fn(),
  exec: {} as { data?: unknown },
  record: vi.fn(),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }), useClerk: () => ({ signOut: vi.fn() }) }))
vi.mock('@/lib/access/use-permissions', async () => {
  const { permissionsValue } = await import('./helpers/permissions-bridge')
  // The signed-in role (h.role) as the BE-17 permissions it holds.
  return { usePermissions: () => { const r = h.role as { role?: string; isLoaded?: boolean }; return permissionsValue(r.role ? [r.role as never] : [], { isLoaded: r.isLoaded ?? true }) } }
})
vi.mock('@/lib/dashboard/api-client', () => ({ useEmployeeMe: () => h.me, useEmployees: () => h.employees }))
vi.mock('@/lib/access/api', async () => {
  const { ACCESS_MATRIX } = await import('./fixtures/access-matrix')
  return { useAccessMatrix: () => ({ data: ACCESS_MATRIX }) }
})
vi.mock('@/lib/dashboard/execution-api-client', () => ({
  useWorkQueues: () => h.queues,
  useStaffExecution: () => ({ ...h.exec, refetch: vi.fn() }),
  useVerifySubmission: () => ({ mutateAsync: vi.fn() }),
  useRejectSubmission: () => ({ mutateAsync: vi.fn() }),
  useRecordStage: () => ({ mutateAsync: h.record }),
  useSwitchExecutionMode: () => ({ mutateAsync: vi.fn() }),
  useDcrOverride: () => ({ mutateAsync: vi.fn() }),
  useUploadStaffExecutionFile: () => ({ mutateAsync: vi.fn() }),
  fetchStaffExecutionFileLink: vi.fn(),
}))
vi.mock('@/lib/handover/staff-api-client', () => ({
  useHandoverPack: () => ({ refetch: vi.fn(), ...h.pack }),
  useTickOrientation: () => ({ mutateAsync: h.tickOrientation }),
  useTickOmContact: () => ({ mutateAsync: h.tickOm }),
  useAcknowledge: () => ({ mutateAsync: h.ack, isPending: false }),
  useIssueLink: () => ({ mutateAsync: h.issue }),
  useRevokeLink: () => ({ mutateAsync: h.revoke }),
  useRegeneratePdf: () => ({ mutateAsync: h.regenerate }),
  fetchPackPdfLink: (...a: unknown[]) => h.pdfLink(...a),
  useProjectServiceRequests: () => ({ refetch: vi.fn(), ...h.project }),
  useRaiseServiceRequest: () => ({ mutateAsync: h.raise }),
  useServiceQueue: (p: unknown) => (h.queueParams(p), { refetch: vi.fn(), isFetching: false, ...h.queue }),
  useServiceRequest: () => ({ refetch: vi.fn(), ...h.detail }),
  useAssignRequest: () => ({ mutateAsync: h.assign }),
  useSetRequestStatus: () => ({ mutateAsync: h.setStatus }),
  useAddRequestNote: () => ({ mutateAsync: h.note }),
  fetchRequestPhotoLink: (...a: unknown[]) => h.photoLink(...a),
}))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

let open: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  navState.reset('/dashboard/operations/12')
  h.role = { role: 'operations', isLoaded: true }
  h.me = { data: { id: 'EMP-OPS-1' } }
  h.employees = { data: undefined }
  h.pack = { data: makePack() }
  h.project = { data: { items: [makeRequest()], can_handle: true } }
  h.queue = { data: { items: [makeRequest()], page: 1, page_size: 25, total: 1, can_handle: true } }
  h.detail = { data: makeRequest() }
  h.queues = { data: undefined }
  open = vi.fn()
  vi.stubGlobal('open', open)
  // jsdom has no canvas: give the signature pad a drawing context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ scale: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn() } as unknown as CanvasRenderingContext2D)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Handover tab — the pack (W1)', () => {
  it('shows each item with its computed status and where it comes from', () => {
    render(<HandoverPanel onboardingId={12} />)
    const report = screen.getByTestId('pack-item-commissioning_report')
    expect(report).toHaveAttribute('data-done', 'true')
    expect(report).toHaveTextContent('From the project records')
    expect(screen.getByTestId('pack-item-final_payment')).toHaveTextContent('From the project records')
    const orientation = screen.getByTestId('pack-item-orientation')
    expect(orientation).toHaveAttribute('data-done', 'false')
    expect(orientation).toHaveTextContent('Ticked by staff')
    expect(screen.getByTestId('pack-complete-badge')).toHaveTextContent('4 of 7 done')
  })

  it('names what is missing until the pack is complete', () => {
    render(<HandoverPanel onboardingId={12} />)
    const missing = screen.getByTestId('pack-missing')
    expect(missing).toHaveTextContent('Handover cannot be recorded until these are done')
    expect(missing).toHaveTextContent('Customer orientation')
    expect(missing).toHaveTextContent('Customer acknowledgement')
    expect(missing).toHaveTextContent('O&M contact given')
  })

  it('says it is ready when complete', () => {
    h.pack = { data: COMPLETE_PACK }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.getByTestId('pack-ready')).toBeInTheDocument()
    expect(screen.queryByTestId('pack-missing')).toBeNull()
  })

  it('a manual tick goes through a confirm dialog with an optional note', async () => {
    h.tickOrientation.mockResolvedValue(makePack())
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: /Mark done… Customer orientation/ }))
    const dialog = await screen.findByRole('dialog')
    expect(h.tickOrientation).not.toHaveBeenCalled()
    await userEvent.type(within(dialog).getByLabelText(/Note/), 'Showed the app')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark done' }))
    await waitFor(() => expect(h.tickOrientation).toHaveBeenCalledWith({ done: true, note: 'Showed the app' }))
  })

  it('undoing a tick asks first and sends done:false', async () => {
    h.pack = { data: makePack({ items: makePack().items.map((i) => (i.key === 'om_contact' ? { ...i, done: true } : i)) }) }
    h.tickOm.mockResolvedValue(makePack())
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: /Undo… O&M contact given/ }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Undo tick' }))
    await waitFor(() => expect(h.tickOm).toHaveBeenCalledWith({ done: false }))
  })

  it('record-backed items cannot be ticked here and say where to do them', () => {
    h.pack = { data: makePack({ items: makePack().items.map((i) => (i.key === 'register_verified' ? { ...i, done: false } : i)) }) }
    render(<HandoverPanel onboardingId={12} />)
    const row = screen.getByTestId('pack-item-register_verified')
    expect(within(row).queryByRole('button')).toBeNull()
    expect(row).toHaveTextContent('Installation tab')
  })

  it('Engineers and Management see the pack but no tick controls', () => {
    h.pack = { data: makePack({ can_act: false }) }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.queryByRole('button', { name: /Mark done/ })).toBeNull()
    expect(screen.getByText('Only Operations and Admin tick these items.')).toBeInTheDocument()
  })

  it('freezes the pack once handover is recorded', () => {
    h.pack = { data: HANDED_OVER_PACK }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.queryByRole('button', { name: /Mark done|Undo…|Record…|Replace…/ })).toBeNull()
    expect(screen.getByText('Handover is recorded, so the pack is frozen.')).toBeInTheDocument()
  })

  it('records an in-person acknowledgement with the customer’s name, and requires the name', async () => {
    h.ack.mockResolvedValue(makePack())
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: /Record… Customer acknowledgement/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('radio', { name: /In person/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record acknowledgement' }))
    expect(h.ack).not.toHaveBeenCalled()
    expect(within(dialog).getByLabelText(/Customer’s name/)).toHaveFocus()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter the customer’s name.')
    await userEvent.type(within(dialog).getByLabelText(/Customer’s name/), 'Bikash Das')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record acknowledgement' }))
    await waitFor(() => expect(h.ack).toHaveBeenCalledWith({ method: 'in_person', customer_name: 'Bikash Das', note: '', file: undefined }))
  })

  it('a signature acknowledgement cannot be sent until the customer has signed', async () => {
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: /Record… Customer acknowledgement/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Record acknowledgement' })).toBeDisabled()
  })

  it('explains an unavailable pack in words, not as an error code', () => {
    h.pack = { error: new ApiError(409, 'x', 'x', { code: 'execution_not_started' }) }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.getByTestId('handover-unavailable')).toHaveTextContent('Installation has not started')
  })
})

describe('Handover tab — PDF and customer link (W2, W3)', () => {
  beforeEach(() => {
    h.pack = { data: HANDED_OVER_PACK }
    h.pdfLink.mockResolvedValue({ url: 'https://files.example/pack.pdf?sig=1', expires_at: '2026-11-02T06:00:00Z' })
  })

  it('before handover only says the PDF and link come later', () => {
    h.pack = { data: makePack() }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.getByTestId('delivery-pending')).toBeInTheDocument()
    expect(screen.queryByTestId('pdf-card')).toBeNull()
  })

  it('fetches a fresh signed URL on every download click', async () => {
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: /Download PDF/ }))
    await userEvent.click(screen.getByRole('button', { name: /Download PDF/ }))
    await waitFor(() => expect(h.pdfLink).toHaveBeenCalledTimes(2))
    expect(open).toHaveBeenCalledWith('https://files.example/pack.pdf?sig=1', '_blank', 'noopener')
  })

  it('explains a held PDF and offers no download', () => {
    h.pack = { data: { ...HANDED_OVER_PACK, pdf: { status: 'held', held_reason: 'O&M terms are a placeholder', generated_at: null } } }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.getByTestId('pdf-status')).toHaveTextContent('Held')
    expect(screen.getByTestId('pdf-held')).toHaveTextContent('still a placeholder')
    expect(screen.getByTestId('pdf-held')).toHaveTextContent('O&M terms are a placeholder')
    expect(screen.queryByRole('button', { name: /Download PDF/ })).toBeNull()
  })

  it('regenerating asks first', async () => {
    h.regenerate.mockResolvedValue(HANDED_OVER_PACK)
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate…' }))
    expect(h.regenerate).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Regenerate' }))
    await waitFor(() => expect(h.regenerate).toHaveBeenCalled())
  })

  it('shows the link state, expiry and the email outcome', () => {
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.getByTestId('link-state')).toHaveTextContent('Active')
    expect(screen.getByTestId('link-card')).toHaveTextContent('does not expire')
    expect(screen.getByTestId('email-status')).toHaveTextContent('Emailed to the customer')
  })

  it('creating a link to copy warns that the old one stops, then shows the new one once', async () => {
    h.issue.mockResolvedValue({ link: { url: 'https://api.gridnova.in/api/v1/public/handover/NEWTOKEN/pdf', expires_at: null }, pack: HANDED_OVER_PACK })
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create a link to copy…' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('stops working at once')
    expect(h.issue).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await waitFor(() => expect(h.issue).toHaveBeenCalledWith(false))
    const shown = await screen.findByTestId('issued-link')
    expect(shown).toHaveTextContent('only time it is shown')
    expect((within(shown).getByLabelText('Customer page link') as HTMLInputElement).value).toBe(`${window.location.origin}/handover/NEWTOKEN`)
    expect((within(shown).getByLabelText('Direct PDF link') as HTMLInputElement).value).toContain('/public/handover/NEWTOKEN/pdf')
  })

  it('resending the email confirms, then issues a new link with email on', async () => {
    h.issue.mockResolvedValue({ link: { url: 'https://api.gridnova.in/api/v1/public/handover/T2/pdf', expires_at: null }, pack: HANDED_OVER_PACK })
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: 'Resend email…' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('issues a new link')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Issue and email' }))
    await waitFor(() => expect(h.issue).toHaveBeenCalledWith(true))
  })

  it('revoking is confirmed and only offered for an active link', async () => {
    h.revoke.mockResolvedValue(HANDED_OVER_PACK)
    const { unmount } = render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: 'Revoke link…' }))
    expect(h.revoke).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke link' }))
    await waitFor(() => expect(h.revoke).toHaveBeenCalled())
    unmount()
    h.pack = { data: { ...HANDED_OVER_PACK, link: { ...HANDED_OVER_PACK.link!, state: 'revoked', revoked_at: '2026-11-01T00:00:00Z' } } }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.queryByRole('button', { name: 'Revoke link…' })).toBeNull()
  })

  it('shows no link controls to a role that cannot act', () => {
    h.pack = { data: { ...HANDED_OVER_PACK, can_act: false } }
    render(<HandoverPanel onboardingId={12} />)
    expect(screen.queryByRole('button', { name: /Create a link|Resend email|Revoke|Regenerate/ })).toBeNull()
  })

  it('surfaces the server’s refusal inside the dialog', async () => {
    h.issue.mockRejectedValue(new ApiError(409, 'x', 'x', { code: 'not_handed_over' }))
    render(<HandoverPanel onboardingId={12} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create a link to copy…' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create link' }))
    expect(await screen.findByText('This project has not been handed over yet.')).toBeInTheDocument()
  })
})

describe('Warranty register (W4)', () => {
  it('labels unconfirmed values as unconfirmed instead of filling them in', () => {
    h.pack = { data: HANDED_OVER_PACK }
    render(<WarrantyPanel onboardingId={12} />)
    const details = screen.getByTestId('warranty-details')
    expect(details).toHaveTextContent('5 years')
    expect(details).toHaveTextContent('12 Oct 2026 → 12 Oct 2031')
    expect(within(details).getAllByTestId('unconfirmed').length).toBeGreaterThanOrEqual(3) // O&M terms, panel life, inverter end date
    expect(details).toHaveTextContent('Grid Nova has not supplied these terms yet.')
    expect(details).not.toHaveTextContent(/25 years|20 years/)
  })

  it('lists units with serials and where each warranty date came from', () => {
    h.pack = { data: HANDED_OVER_PACK }
    render(<WarrantyPanel onboardingId={12} />)
    const units = screen.getAllByTestId('warranty-unit')
    expect(units[0]).toHaveTextContent('MOD-001')
    expect(units[0]).toHaveTextContent('From the serial register')
    expect(units[1]).toHaveTextContent('INV-009')
    expect(units[1]).toHaveTextContent('No warranty date')
  })

  it('shows a confirmed panel life when the server has one', () => {
    h.pack = { data: { ...HANDED_OVER_PACK, warranty: { ...HANDED_OVER_PACK.warranty!, panel_performance_life_years: 25 } } }
    render(<WarrantyPanel onboardingId={12} />)
    expect(screen.getByTestId('warranty-details')).toHaveTextContent('25 years')
  })

  it('says nothing is registered before handover', () => {
    h.pack = { data: makePack() }
    render(<WarrantyPanel onboardingId={12} />)
    expect(screen.getByTestId('warranty-pending')).toBeInTheDocument()
  })
})

describe('Service requests on a project and in the queue (W5)', () => {
  it('lists the project’s requests with the within-warranty badge', () => {
    render(<ProjectServiceRequests onboardingId={12} />)
    const line = screen.getByTestId('service-request-line')
    expect(within(line).getByTestId('within-warranty')).toBeInTheDocument()
    expect(within(line).getByRole('link', { name: /#31 · No generation/ })).toHaveAttribute('href', '/dashboard/service-requests/31')
  })

  it('shows an out-of-warranty request differently, and nothing when the warranty is unknown', () => {
    h.project = { data: { items: [makeRequest({ request_id: 1, within_warranty: false }), makeRequest({ request_id: 2, within_warranty: null })], can_handle: true } }
    render(<ProjectServiceRequests onboardingId={12} />)
    expect(screen.getAllByTestId('out-of-warranty')).toHaveLength(1)
    expect(screen.queryAllByTestId('within-warranty')).toHaveLength(0)
  })

  it('raises a request on the customer’s behalf', async () => {
    h.raise.mockResolvedValue(makeRequest())
    render(<ProjectServiceRequests onboardingId={12} />)
    await userEvent.selectOptions(screen.getByLabelText(/What is the problem/), 'inverter_error')
    await userEvent.type(screen.getByLabelText(/Describe the problem/), 'Inverter shows E04')
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    await waitFor(() => expect(h.raise).toHaveBeenCalledWith({ category: 'inverter_error', description: 'Inverter shows E04', contact_phone: '', files: [] }))
    expect(await screen.findByText('Your service request was sent.')).toBeInTheDocument()
  })

  it('does not offer the form to a role that cannot handle requests', () => {
    h.project = { data: { items: [], can_handle: false } }
    render(<ProjectServiceRequests onboardingId={12} />)
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.getByTestId('no-requests')).toBeInTheDocument()
  })

  it('the queue sends its filters to the server', () => {
    navState.reset('/dashboard/service-requests', 'open=1&overdue=1&warranty=in&category=no_generation&assignee=unassigned&status=open')
    render(<ServiceRequestQueue />)
    expect(h.queueParams).toHaveBeenCalledWith(
      expect.objectContaining({ open: true, overdue: true, within_warranty: true, category: 'no_generation', assignee: 'unassigned', status: 'open', page: 1 }),
    )
  })

  it('shows SLA as unset rather than inventing a due date, and flags an overdue one', () => {
    h.queue = { data: { items: [makeRequest(), makeRequest({ request_id: 32, sla_due_at: '2026-11-03T05:00:00Z', overdue: true })], page: 1, page_size: 25, total: 2, can_handle: true } }
    render(<ServiceRequestQueue />)
    const rows = screen.getAllByTestId('service-request-row')
    expect(rows[0]).toHaveTextContent('No SLA set')
    expect(within(rows[1]).getByTestId('sla-overdue')).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('03 Nov 2026')
  })

  it('shows the open and overdue counts from the work queues', () => {
    h.queues = { data: { service_requests: { open: 6, overdue: 2 } } }
    render(<ServiceRequestQueue />)
    expect(screen.getByTestId('service-counts')).toHaveTextContent('6')
    expect(screen.getByTestId('service-counts')).toHaveTextContent('2')
  })

  it('Accounts gets no-access to the page, other staff see it', () => {
    h.role = { role: 'accounts', isLoaded: true }
    const { unmount } = render(<ServiceRequestsPage />)
    expect(screen.getByTestId('no-access')).toBeInTheDocument()
    unmount()
    h.role = { role: 'management', isLoaded: true }
    render(<ServiceRequestsPage />)
    expect(screen.getByRole('heading', { name: 'Service requests' })).toBeInTheDocument()
    expect(screen.getByText('Read-only view.')).toBeInTheDocument()
  })
})

describe('Service request detail (W5)', () => {
  it('shows history, photos and the append-only trail newest first', () => {
    render(<ServiceRequestDetail requestId={31} />)
    const items = screen.getAllByTestId('history-item')
    expect(items[0]).toHaveTextContent('Internal note')
    expect(items[0]).toHaveTextContent('Called the customer.')
    expect(items[1]).toHaveTextContent('Raised')
  })

  it('opens a photo through a fresh signed link on each click', async () => {
    h.photoLink.mockResolvedValue({ url: 'https://files.example/ph.jpg?sig=2' })
    render(<ServiceRequestDetail requestId={31} />)
    await userEvent.click(screen.getByRole('button', { name: /Photo 1/ }))
    await userEvent.click(screen.getByRole('button', { name: /Photo 1/ }))
    await waitFor(() => expect(h.photoLink).toHaveBeenCalledTimes(2))
    expect(h.photoLink).toHaveBeenCalledWith(31, 'ph-1', 'tok')
    expect(open).toHaveBeenCalledWith('https://files.example/ph.jpg?sig=2', '_blank', 'noopener')
  })

  it('resolving needs a note', async () => {
    h.setStatus.mockResolvedValue(makeRequest({ status: 'resolved' }))
    render(<ServiceRequestDetail requestId={31} />)
    await userEvent.click(screen.getByRole('button', { name: 'Resolve…' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Mark resolved' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/What was done/), 'Replaced the fuse')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark resolved' }))
    await waitFor(() => expect(h.setStatus).toHaveBeenCalledWith({ requestId: 31, status: 'resolved', note: 'Replaced the fuse' }))
  })

  it('starts work without a note', async () => {
    h.setStatus.mockResolvedValue(makeRequest({ status: 'in_progress' }))
    render(<ServiceRequestDetail requestId={31} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start work' }))
    await waitFor(() => expect(h.setStatus).toHaveBeenCalledWith({ requestId: 31, status: 'in_progress' }))
  })

  it('non-admins can assign to themselves or clear; only an Admin gets a picker of staff', async () => {
    h.assign.mockResolvedValue(makeRequest())
    const { unmount } = render(<ServiceRequestDetail requestId={31} />)
    expect(screen.queryByRole('button', { name: 'Assign…' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Assign to me' }))
    await waitFor(() => expect(h.assign).toHaveBeenCalledWith({ requestId: 31, assigneeId: 'EMP-OPS-1' }))
    unmount()

    h.role = { role: 'admin', isLoaded: true }
    h.employees = { data: [
      { id: 'EMP-OPS-1', name: 'Olive Ops', role: 'operations', is_active: true },
      { id: 'EMP-SALES-1', name: 'Sam Sales', role: 'sales', is_active: true },
      { id: 'EMP-ENG-1', name: 'Eli Eng', role: 'engineer', is_active: false },
    ] }
    render(<ServiceRequestDetail requestId={31} />)
    await userEvent.click(screen.getByRole('button', { name: 'Assign…' }))
    const dialog = await screen.findByRole('dialog')
    const options = within(dialog).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Nobody (clear assignment)', 'Olive Ops (operations)'])
    await userEvent.selectOptions(within(dialog).getByLabelText('Assign to'), 'EMP-OPS-1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(h.assign).toHaveBeenLastCalledWith({ requestId: 31, assigneeId: 'EMP-OPS-1' }))
  })

  it('a read-only role sees the request but no action buttons', () => {
    h.detail = { data: makeRequest({ can_handle: false }) }
    render(<ServiceRequestDetail requestId={31} />)
    expect(screen.queryByTestId('request-actions')).toBeNull()
    expect(screen.getByText(/Read-only/)).toBeInTheDocument()
  })

  it('a closed request offers no status change', () => {
    h.detail = { data: makeRequest({ status: 'resolved', resolution_note: 'Done', closed_at: '2026-11-03T00:00:00Z' }) }
    render(<ServiceRequestDetail requestId={31} />)
    expect(screen.queryByRole('button', { name: /Resolve…|Reject…|Start work/ })).toBeNull()
  })

  it('refusals are plain sentences', async () => {
    h.note.mockRejectedValue(new ApiError(409, 'x', 'x', { code: 'request_closed' }))
    render(<ServiceRequestDetail requestId={31} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add internal note…' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'hello')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add note' }))
    expect(await screen.findByText('This request is closed.')).toBeInTheDocument()
  })
})

describe('Record handover complete is gated by the pack (W1)', () => {
  const stage = (over: object = {}) => ({
    stage: 'handover_complete',
    label: 'Handover complete',
    recorded: false,
    recorded_at: null,
    recorded_by: null,
    via: null,
    submission: null,
    evidence_required: { text: [], documents: [], optional_documents: [], photos: [], register_verified: false },
    blockers: [],
    ...over,
  })
  const exec = {
    onboarding_id: 12,
    project_id: 7,
    execution_mode: 'grid_nova',
    started_at: '2026-02-01T00:00:00Z',
    register_verified_at: null,
    current_stage: 'handover_complete',
    next_stage: 'handover_complete',
    next_stage_is_execution: true,
    aging: { days_in_stage: 1, stuck_threshold_days: 21, is_stuck: false },
    pending_submission: null,
    stages: [stage()],
    photo_slots: [],
    document_types: [],
    files: { photos: {}, documents: {} },
    flags: [],
    customer: { name: 'Bikash Das', mobile: null, project_reference_id: null, site: { address: null, pin_code: null, territory: null, latitude: null, longitude: null }, associate: null },
    can_verify: false,
    can_record: true,
  }
  beforeEach(() => {
    h.exec = { data: exec }
  })

  it('disables “Record handover complete” and lists the missing items while the pack is incomplete', () => {
    render(asRoles(['operations'], <ExecutionDetailPanel onboardingId={12} />))
    const gate = screen.getByTestId('handover-gate')
    expect(gate).toHaveTextContent('Customer orientation')
    expect(gate).toHaveTextContent('O&M contact given')
    expect(screen.getByRole('button', { name: 'Record handover complete' })).toBeDisabled()
  })

  it('enables it once the pack is complete', () => {
    h.pack = { data: COMPLETE_PACK }
    render(asRoles(['operations'], <ExecutionDetailPanel onboardingId={12} />))
    expect(screen.queryByTestId('handover-gate')).toBeNull()
    expect(screen.getByRole('button', { name: 'Record handover complete' })).toBeEnabled()
  })

  it('is not gated when the project does not require a pack', () => {
    h.pack = { data: makePack({ pack_required: false }) }
    render(asRoles(['operations'], <ExecutionDetailPanel onboardingId={12} />))
    expect(screen.queryByTestId('handover-gate')).toBeNull()
    expect(screen.getByRole('button', { name: 'Record handover complete' })).toBeEnabled()
  })

  it('renders the server’s 422 as the same list', async () => {
    h.pack = { data: COMPLETE_PACK } // the client thinks it is complete; the server disagrees
    h.record.mockRejectedValue(new ApiError(422, 'x', 'x', GATE_422_BODY))
    render(asRoles(['operations'], <ExecutionDetailPanel onboardingId={12} />))
    await userEvent.click(screen.getByRole('button', { name: 'Record handover complete' }))
    const list = await screen.findByTestId('gate-422-list')
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Customer orientation', 'Customer acknowledgement'])
    expect(screen.getByText(/Handover cannot be recorded yet\. The pack is missing: Customer orientation; Customer acknowledgement\./)).toBeInTheDocument()
  })
})

describe('nav and work-queue badges (W6)', () => {
  const labels = (role: Role) => visibleNavItems(permissionsFor([role])).map((i) => i.label)
  it('Service requests is shown to the roles the backend lets read it, never to Accounts', () => {
    for (const role of ['admin', 'management', 'engineer', 'operations', 'sales'] as Role[]) expect(labels(role), role).toContain('Service requests')
    expect(labels('accounts')).not.toContain('Service requests')
  })
  it('counts open requests, not open + overdue (overdue is part of open)', () => {
    const q = { service_requests: { open: 6, overdue: 2 } }
    expect(queueBadgeCount('service_requests', q)).toBe(6)
    expect(overdueServiceRequestCount(q)).toBe(2)
    expect(queueBadgeCount('service_requests', undefined)).toBe(0)
  })
  it('hrefs stay unique', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
