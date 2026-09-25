import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OverviewPage from '@/app/dashboard/page'
import LeadsPage from '@/app/dashboard/leads/page'
import LeadDetailPage from '@/app/dashboard/leads/[id]/page'
import ProposalsPage from '@/app/dashboard/proposals/page'
import ProposalDetailPage from '@/app/dashboard/proposals/[id]/page'
import AnalyticsPage from '@/app/dashboard/analytics/page'
import AuditLogPage from '@/app/dashboard/audit-log/page'
import type {
  ActivityItem,
  AuditLog,
  LeadDetail,
  LeadSummary,
  OverviewStats,
  ProposalDetail,
  ProposalSummary,
} from '@/lib/dashboard/types'

// Systematic sweep of every remaining dashboard page component — the same
// technique that actually caught a real hydration bug on /dashboard/agents
// (see dom-nesting-probe.test.tsx): render the real, unmocked component tree
// via react-dom and assert zero DOM-nesting console.error warnings, across
// empty/populated/error states, not just one happy path. Only the data
// hooks, Clerk, and next/navigation are mocked; every component under test
// (Card, Badge, Table, Dialog, etc.) is the real one.

const mockUseUser = vi.fn()
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const mockUseOverviewStats = vi.fn()
const mockUseActivityFeed = vi.fn()
const mockUseLeads = vi.fn()
const mockUseLead = vi.fn()
const mockUseDraftProposal = vi.fn()
const mockUseProposals = vi.fn()
const mockUseProposal = vi.fn()
const mockUseProposalPdf = vi.fn()
const mockUseApproveProposal = vi.fn()
const mockUseManagerSignOff = vi.fn()
const mockUseRequestRevision = vi.fn()
const mockUseSendProposal = vi.fn()
const mockUseAnalytics = vi.fn()
const mockUseAuditLog = vi.fn()
const mockUseCreateLead = vi.fn()
const mockUseChangeLeadStage = vi.fn()
const mockUseReassignLead = vi.fn()
const mockUseUpdateLeadFields = vi.fn()
const mockUseAssignableEmployees = vi.fn()
const mockUseAdjustPricing = vi.fn()

vi.mock('@/lib/dashboard/api-client', () => ({
  useOverviewStats: () => mockUseOverviewStats(),
  useActivityFeed: () => mockUseActivityFeed(),
  useLeads: () => mockUseLeads(),
  downloadLeadsCsv: vi.fn(),
  useLead: () => mockUseLead(),
  useDraftProposal: () => mockUseDraftProposal(),
  useProposals: () => mockUseProposals(),
  downloadProposalsCsv: vi.fn(),
  useProposal: () => mockUseProposal(),
  useProposalPdf: () => mockUseProposalPdf(),
  useApproveProposal: () => mockUseApproveProposal(),
  useManagerSignOff: () => mockUseManagerSignOff(),
  useRequestRevision: () => mockUseRequestRevision(),
  useSendProposal: () => mockUseSendProposal(),
  useAnalytics: () => mockUseAnalytics(),
  useAuditLog: () => mockUseAuditLog(),
  useCreateLead: () => mockUseCreateLead(),
  useChangeLeadStage: () => mockUseChangeLeadStage(),
  useReassignLead: () => mockUseReassignLead(),
  useUpdateLeadFields: () => mockUseUpdateLeadFields(),
  useAssignableEmployees: () => mockUseAssignableEmployees(),
  useAdjustPricing: () => mockUseAdjustPricing(),
  fetchProposalPdf: vi.fn(),
}))

// Analytics lazily loads recharts via next/dynamic — stub it out so this
// sweep exercises AnalyticsPage's own JSX, not recharts' internals.
vi.mock('@/components/dashboard/analytics-charts', () => ({
  FunnelChart: () => <div>Funnel chart</div>,
  ReportingSections: () => <div>Reporting sections</div>,
}))

const idleMutation = { mutateAsync: vi.fn(), isPending: false }

function expectNoNestingWarnings(spy: ReturnType<typeof vi.spyOn>) {
  const nestingWarnings = spy.mock.calls.filter((args: unknown[]) => String(args[0]).includes('cannot be a descendant of'))
  expect(nestingWarnings).toEqual([])
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockReturnValue({ user: { firstName: 'Ravi', publicMetadata: { role: 'admin' } } })
  mockUseDraftProposal.mockReturnValue(idleMutation)
  mockUseApproveProposal.mockReturnValue(idleMutation)
  mockUseManagerSignOff.mockReturnValue(idleMutation)
  mockUseRequestRevision.mockReturnValue(idleMutation)
  mockUseSendProposal.mockReturnValue(idleMutation)
  mockUseProposalPdf.mockReturnValue({ data: undefined })
  mockUseCreateLead.mockReturnValue(idleMutation)
  mockUseChangeLeadStage.mockReturnValue(idleMutation)
  mockUseReassignLead.mockReturnValue(idleMutation)
  mockUseUpdateLeadFields.mockReturnValue(idleMutation)
  mockUseAssignableEmployees.mockReturnValue({ data: [], isLoading: false })
  mockUseAdjustPricing.mockReturnValue(idleMutation)
})

const OVERVIEW_STATS: OverviewStats = {
  new_leads_today: 3,
  follow_ups_due: 2,
  pending_approval: 1,
  pending_manager_signoff: 0,
  trends: { new_leads_today: 1, follow_ups_due: -1, pending_approval: 0, pending_manager_signoff: 0 },
}

const ACTIVITY_ITEM: ActivityItem = {
  description: 'Lead #12 status changed by Priya',
  entity_type: 'lead',
  entity_id: '12',
  action: 'status_changed_to_qualified',
  actor: 'Priya',
  created_at: '2026-01-01T00:00:00Z',
}

describe('Overview — DOM validity', () => {
  it('empty (all caught up)', async () => {
    mockUseOverviewStats.mockReturnValue({
      data: { ...OVERVIEW_STATS, new_leads_today: 0, follow_ups_due: 0, pending_approval: 0 },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    mockUseActivityFeed.mockReturnValue({ data: [], isLoading: false, error: null })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<OverviewPage />)
    expect(screen.getByText("You’re all caught up")).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated (stats + activity feed)', async () => {
    mockUseOverviewStats.mockReturnValue({ data: OVERVIEW_STATS, isLoading: false, error: null, refetch: vi.fn() })
    mockUseActivityFeed.mockReturnValue({ data: [ACTIVITY_ITEM], isLoading: false, error: null })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<OverviewPage />)
    expect(screen.getByText(/lead #12 status changed/i)).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('error state', async () => {
    mockUseOverviewStats.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    mockUseActivityFeed.mockReturnValue({ data: undefined, isLoading: false, error: null })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<OverviewPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })
})

const LEAD_SUMMARY: LeadSummary = {
  id: 1, customer_id: 1, customer_name: 'Ravi Sharma', pipeline_stage: 'qualified', lead_score: 'high', source: 'website_chat', created_at: '2026-01-01T00:00:00Z',
}

describe('Leads (list) — DOM validity', () => {
  it('empty', () => {
    mockUseLeads.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<LeadsPage />)
    expect(screen.getByText('No leads found')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated', () => {
    mockUseLeads.mockReturnValue({ data: [LEAD_SUMMARY], isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<LeadsPage />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('error state', () => {
    mockUseLeads.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<LeadsPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })
})

const LEAD_DETAIL: LeadDetail = {
  lead_id: 1,
  customer: { id: 1, name: 'Ravi Sharma', company: 'Sharma Textiles', email: 'ravi@example.com' },
  pipeline_stage: 'qualified',
  lead_score: 'high',
  collected_fields: { name: 'Ravi Sharma', capacity_kw: 5 },
  proposals: [{ id: 4, version: 1, status: 'draft', total_value: 500000 }],
  timeline: [{ event_type: 'created', description: 'Lead created', created_at: '2026-01-01T00:00:00Z' }],
  messages: [{ role: 'customer', content: 'Hi, interested in solar', created_at: '2026-01-01T00:00:00Z' }],
}

describe('Lead Detail — DOM validity', () => {
  it('loading', () => {
    mockUseLead.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<LeadDetailPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated, fully qualified (shows the Generate Draft tooltip button)', () => {
    mockUseLead.mockReturnValue({ data: { ...LEAD_DETAIL, collected_fields: { name: 'x', email: 'x', project_type: 'x', location: 'x', capacity_kw: 5 } }, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<LeadDetailPage />)
    expect(screen.getByText('Lead #1')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('not found / error state', () => {
    mockUseLead.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<LeadDetailPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })
})

const PROPOSAL_SUMMARY: ProposalSummary = {
  id: 4, lead_id: 1, version: 1, status: 'pending_approval', total_value: 500000,
  requires_manager_signoff: true, pdf_url: null, date_created: '2026-01-01T00:00:00Z', date_sent: null,
  lead: { id: 1, pipeline_stage: 'qualified', lead_score: 'high' },
  customer: { id: 1, name: 'Ravi Sharma', company: null, email: 'ravi@example.com' },
}

describe('Proposals (list) — DOM validity', () => {
  it('empty', () => {
    mockUseProposals.mockReturnValue({ data: { items: [], page: 1, page_size: 50, total: 0 }, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<ProposalsPage />)
    expect(screen.getByText('No proposals found')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated', () => {
    mockUseProposals.mockReturnValue({ data: { items: [PROPOSAL_SUMMARY], page: 1, page_size: 50, total: 1 }, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<ProposalsPage />)
    expect(screen.getByText('#4')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('error state', () => {
    mockUseProposals.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<ProposalsPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })
})

const PROPOSAL_DETAIL: ProposalDetail = {
  id: 4, lead_id: 1, version: 1, status: 'sent',
  content: { project_overview: 'A rooftop system', scope_of_work: 'Install and commission' },
  total_value: 500000, requires_manager_signoff: true, revision_reason: null, pdf_url: 'https://example.com/p.pdf',
  date_created: '2026-01-01T00:00:00Z', date_sent: '2026-01-02T00:00:00Z',
  accept_url: 'https://example.com/accept/abc', accepted_at: null,
  customer: { id: 1, name: 'Ravi Sharma', company: 'Sharma Textiles', email: 'ravi@example.com' },
  lead: { id: 1, pipeline_stage: 'qualified', lead_score: 'high' },
  versions: [{ id: 4, version: 1, status: 'sent', total_value: 500000, date_created: '2026-01-01T00:00:00Z' }],
}

describe('Proposal Detail — DOM validity', () => {
  it('loading', () => {
    mockUseProposal.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<ProposalDetailPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated — sent, with manager-signoff badge, accept-link and version history', () => {
    mockUseProposal.mockReturnValue({ data: PROPOSAL_DETAIL, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<ProposalDetailPage />)
    expect(screen.getByText('Proposal #4')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated — draft, revision requested (shows the amber revision-reason notice)', () => {
    mockUseProposal.mockReturnValue({
      data: { ...PROPOSAL_DETAIL, status: 'revision_requested', revision_reason: 'Please re-check pricing', accept_url: undefined, accepted_at: undefined },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<ProposalDetailPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('not found / error state', () => {
    mockUseProposal.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<ProposalDetailPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })
})

describe('Analytics — DOM validity', () => {
  it('empty (no data for period)', () => {
    mockUseAnalytics.mockReturnValue({
      data: { new_leads_count: 0, qualification_completion_rate: null, lead_to_proposal_conversion_rate: null, avg_proposal_turnaround_hours: null, funnel: null, ai_call_count: 0, ai_estimated_cost: 0, escalation_rate: null },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<AnalyticsPage />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated, with the lazily-loaded funnel chart', async () => {
    mockUseAnalytics.mockReturnValue({
      data: {
        new_leads_count: 24, qualification_completion_rate: 0.6, lead_to_proposal_conversion_rate: 0.4,
        avg_proposal_turnaround_hours: 5.2, funnel: { new: 24, qualified: 14, proposal_sent: 8, won: 3 },
        ai_call_count: 120, ai_estimated_cost: 1.2, escalation_rate: 0.05,
      },
      isLoading: false, error: null, refetch: vi.fn(),
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AnalyticsPage />)
    // next/dynamic resolves asynchronously even with the module mocked.
    await screen.findByText('Funnel chart')
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('error state', () => {
    mockUseAnalytics.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<AnalyticsPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('restricted for the engineer role', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'engineer' } } })
    mockUseAnalytics.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<AnalyticsPage />)
    expect(screen.getByText('Access Restricted')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })
})

const AUDIT_LOG_ENTRY: AuditLog = {
  id: 1, entity_type: 'employee', entity_id: 'emp-admin-1', action: 'created', performed_by: 'system',
  before_value: null, after_value: { role: 'admin' }, created_at: '2026-01-01T00:00:00Z',
}

describe('Audit Log — DOM validity', () => {
  it('empty', () => {
    mockUseAuditLog.mockReturnValue({ data: { items: [], page: 1, page_size: 50, total: 0 }, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<AuditLogPage />)
    expect(screen.getByText('No audit log entries found')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('populated', () => {
    mockUseAuditLog.mockReturnValue({ data: { items: [AUDIT_LOG_ENTRY], page: 1, page_size: 50, total: 1 }, isLoading: false, error: null, refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<AuditLogPage />)
    expect(screen.getByText('created')).toBeInTheDocument()
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })

  it('error state', () => {
    mockUseAuditLog.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<AuditLogPage />)
    expectNoNestingWarnings(spy)
    spy.mockRestore()
  })
})
