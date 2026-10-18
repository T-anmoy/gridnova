import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LeadDetailPage from '@/app/(internal)/dashboard/leads/[id]/page'
import LeadsPage from '@/app/(internal)/dashboard/leads/page'
import ExecutionDetailPanel from '@/components/dashboard/ExecutionDetailPanel'
import { NovaShellProvider, useNovaShell } from '@/lib/nova/page-context'
import { navState } from './helpers/mock-navigation'
import { withI18n } from './helpers/i18n'
import { leadItem, leadPage } from './fixtures/leads-contract'
import { staffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import type { LeadDetail } from '@/lib/dashboard/types'
import type { StaffExecutionDetail } from '@/lib/dashboard/execution-types'

const h = vi.hoisted(() => ({ lead: {} as { data?: unknown }, exec: {} as { data?: unknown } }))
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { id: 'user-1', publicMetadata: { role: 'admin' } } }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('token') }),
}))
vi.mock('next/navigation', async () => ({ ...(await import('./helpers/mock-navigation')).navigationMock, useParams: () => ({ id: '19' }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/dashboard/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dashboard/api-client')>()),
  useLeads: () => ({ data: leadPage([leadItem(12)]), isLoading: false, error: null, refetch: vi.fn(), isPlaceholderData: false }),
  useLead: () => ({ ...h.lead, isLoading: false, error: null, refetch: vi.fn() }),
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDraftProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeLeadStage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReassignLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateLeadFields: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssignableEmployees: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/lib/dashboard/staff-leads-api-client', async () => (await import('./helpers/staff-leads-mocks')).staffLeadsApiMock)
vi.mock('@/lib/dashboard/execution-api-client', () => ({
  useStaffExecution: () => ({ ...h.exec, refetch: vi.fn() }),
  useVerifySubmission: () => ({ mutateAsync: vi.fn() }),
  useRejectSubmission: () => ({ mutateAsync: vi.fn() }),
  useRecordStage: () => ({ mutateAsync: vi.fn() }),
  useSwitchExecutionMode: () => ({ mutateAsync: vi.fn() }),
  useDcrOverride: () => ({ mutateAsync: vi.fn() }),
  useUploadStaffExecutionFile: () => ({ mutateAsync: vi.fn() }),
  fetchStaffExecutionFileLink: vi.fn(),
}))

const FULL: LeadDetail = {
  lead_id: 19,
  customer: { id: 7, name: 'Test Customer A', email: 'a@example.test', company: null },
  pipeline_stage: 'qualified',
  lead_score: 'high',
  collected_fields: { name: 'x', email: 'x', project_type: 'x', location: 'x', capacity_kw: 5 },
  assigned_employee_id: null,
  proposals: [],
  timeline: [],
  messages: [],
}

function Probe() {
  const { context } = useNovaShell()
  return <output data-testid="nova-context-probe">{JSON.stringify(context)}</output>
}
const probe = () => JSON.parse(screen.getByTestId('nova-context-probe').textContent ?? 'null')

function execDetail(projectRef: string | null): StaffExecutionDetail {
  return {
    onboarding_id: 5, project_id: 9, execution_mode: 'associate', started_at: '2026-02-01T00:00:00Z', register_verified_at: null,
    current_stage: null, next_stage: null, next_stage_is_execution: true,
    aging: { days_in_stage: 3, stuck_threshold_days: 21, is_stuck: false },
    pending_submission: null, stages: [], photo_slots: [], document_types: [], files: { photos: {}, documents: {} }, flags: [],
    customer: { name: 'Bikash Das', mobile: null, project_reference_id: projectRef, site: { address: null, pin_code: null, territory: null, latitude: null, longitude: null }, associate: null },
    can_verify: false, can_record: false,
  } as unknown as StaffExecutionDetail
}

beforeEach(() => {
  navState.reset('/dashboard/leads/19')
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('pages hand their record to Ask Nova', () => {
  it('a lead page sends lead_id and customer_id', () => {
    h.lead = { data: FULL }
    render(<NovaShellProvider><Probe /><LeadDetailPage /></NovaShellProvider>)
    expect(probe()).toEqual({ lead_id: 19, customer_id: 7 })
  })

  it('the Engineer view has no customer, so only lead_id is sent', () => {
    h.lead = { data: { lead_id: 19, pipeline_stage: 'qualified', collected_fields: { project_type: 'rooftop' } } }
    render(<NovaShellProvider><Probe /><LeadDetailPage /></NovaShellProvider>)
    expect(probe()).toEqual({ lead_id: 19 })
  })

  it('a project (operations) page sends project_ref once the backend has given it', () => {
    h.exec = { data: execDetail('GNE-WB-RES-2026-00125') }
    render(withI18n(<NovaShellProvider><Probe /><ExecutionDetailPanel onboardingId={5} role="operations" /></NovaShellProvider>))
    expect(probe()).toEqual({ project_ref: 'GNE-WB-RES-2026-00125' })
  })

  it('a project with no reference yet sends no context (nothing guessed)', () => {
    h.exec = { data: execDetail(null) }
    render(withI18n(<NovaShellProvider><Probe /><ExecutionDetailPanel onboardingId={5} role="operations" /></NovaShellProvider>))
    expect(probe()).toBeNull()
  })

  it('the context is cleared when the page goes away', () => {
    h.lead = { data: FULL }
    function Both({ show }: { show: boolean }) {
      return <NovaShellProvider><Probe />{show && <LeadDetailPage />}</NovaShellProvider>
    }
    const { rerender } = render(<Both show />)
    expect(probe()).toEqual({ lead_id: 19, customer_id: 7 })
    rerender(<Both show={false} />)
    expect(probe()).toBeNull()
  })

  it('the leads list sends none: "this lead" is not a thing there', () => {
    render(<NovaShellProvider><Probe /><LeadsPage /></NovaShellProvider>)
    expect(probe()).toBeNull()
  })

  it('pages work without the dashboard shell (no provider): nothing breaks', () => {
    h.lead = { data: FULL }
    render(<LeadDetailPage />)
    expect(screen.getByRole('button', { name: /Change Stage/ })).toBeInTheDocument()
  })
})

describe('the dashboard is English-only', () => {
  it('the leads screens ignore a Hindi or Bengali NEXT_LOCALE cookie, before and after mount', async () => {
    for (const locale of ['hi', 'bn']) {
      document.cookie = `NEXT_LOCALE=${locale}; path=/`
      navState.reset('/dashboard/leads')
      const { unmount } = render(<LeadsPage />)
      await Promise.resolve()
      expect(screen.getAllByText(new RegExp(staffLeadsCopy.filters.heading)).length).toBeGreaterThan(0)
      expect(document.body.textContent).not.toMatch(/[ऀ-ॿঀ-৿]/)
      unmount()
    }
    document.cookie = 'NEXT_LOCALE=; path=/; max-age=0'
  })

  it('the lead detail page too', async () => {
    document.cookie = 'NEXT_LOCALE=hi; path=/'
    h.lead = { data: FULL }
    render(<LeadDetailPage />)
    await Promise.resolve()
    expect(document.body.textContent).not.toMatch(/[ऀ-ॿঀ-৿]/)
    document.cookie = 'NEXT_LOCALE=; path=/; max-age=0'
  })
})
