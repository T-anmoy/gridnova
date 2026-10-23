import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clearAutosaveDraft, readDraft, writeDraft } from '@/lib/associate/useAutosaveDraft'
import { STAFF_REGISTER_DRAFT_PREFIX } from '@/lib/associate/serial-draft'

// ── N2: associate approval is asynchronous (BE-3) ────────────────────────

const useAdminAssociate = vi.fn()
vi.mock('@/lib/associate/api-client', async (orig) => ({
  ...(await orig<object>()),
  useAdminAssociate: (...a: unknown[]) => useAdminAssociate(...a),
  useSetAssociateStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRetryClerkInvite: () => ({ mutate: vi.fn(), isPending: false }),
  useRegenerateAssociateDocuments: () => ({ mutate: vi.fn(), isPending: false }),
  fetchAdminAssociateDocumentLink: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'GNA-WB-26-00001' }), useRouter: () => ({ push: vi.fn() }), usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const signOut = vi.fn(async () => {})
vi.mock('@/lib/commissions/staff-api-client', () => ({
  useAssociateRate: () => ({ data: undefined, isLoading: true }),
  useSetAssociateRate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssociatePerformance: () => ({ data: undefined, isLoading: true }),
}))
vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUser: () => ({ user: { publicMetadata: { role: 'admin' }, firstName: 'Ann', emailAddresses: [] } }),
  useAuth: () => ({ getToken: async () => 't' }),
  useClerk: () => ({ signOut }),
}))

import { isPreparing } from '@/lib/associate/api-client'
import AssociateDetailPage from '@/app/(internal)/dashboard/associate-network/associates/[id]/page'

const now = Date.now()
const associate = (over: Record<string, unknown> = {}) => ({
  associate_id: 'GNA-WB-26-00001', full_name: 'Bikash Das', status: 'active', status_reason: null, email: 'b@example.com', mobile: '9', associate_type: 'associate',
  capability: null, level: null, territory: 'WB', approved_at: new Date(now - 30_000).toISOString(), clerk_user_bound: false, seat: null,
  clerk_invite_status: null, documents: { id_card: false, welcome_letter: false, generated_at: null, error: null }, ...over,
})
const ok = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })

describe('N2 — approval is asynchronous', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a null invite status on a fresh approval means "preparing", never "failed"', () => {
    useAdminAssociate.mockReturnValue(ok(associate()))
    render(<AssociateDetailPage />)
    expect(screen.getByTestId('approval-preparing')).toHaveTextContent(/invite and documents are being prepared/)
    expect(screen.getByTestId('invite-preparing')).toBeInTheDocument()
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry Clerk invite' })).not.toBeInTheDocument()
  })

  it('polls: the page passes a deadline about a minute out', () => {
    useAdminAssociate.mockReturnValue(ok(associate()))
    render(<AssociateDetailPage />)
    const poll = useAdminAssociate.mock.calls[0][1] as { until: number }
    expect(poll.until - Date.now()).toBeGreaterThan(55_000)
    expect(poll.until - Date.now()).toBeLessThanOrEqual(60_000)
  })

  it('only the string "failed" is a failure, and it offers the retry', () => {
    useAdminAssociate.mockReturnValue(ok(associate({ clerk_invite_status: 'failed', documents: { id_card: true, welcome_letter: true, generated_at: 'x', error: null } })))
    render(<AssociateDetailPage />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry Clerk invite' })).toBeInTheDocument()
  })

  it('stops saying "preparing" once the invite is set and the ID card exists', () => {
    useAdminAssociate.mockReturnValue(ok(associate({ clerk_invite_status: 'sent', documents: { id_card: true, welcome_letter: true, generated_at: 'x', error: null } })))
    render(<AssociateDetailPage />)
    expect(screen.queryByTestId('approval-preparing')).not.toBeInTheDocument()
    expect(screen.getByText('sent')).toBeInTheDocument()
  })

  it('isPreparing: needs both the invite and the ID card, and ignores old records', () => {
    const base = associate()
    expect(isPreparing(base as never)).toBe(true)
    expect(isPreparing({ ...base, clerk_invite_status: 'sent' } as never)).toBe(true) // no ID card yet
    expect(isPreparing({ ...base, clerk_invite_status: 'sent', documents: { ...base.documents, id_card: true } } as never)).toBe(false)
    expect(isPreparing({ ...base, approved_at: new Date(now - 3_600_000).toISOString() } as never)).toBe(false)
    expect(isPreparing(undefined)).toBe(false)
  })
})

// ── N3: staff serial drafts do not survive staff sign-out ────────────────

vi.mock('@/lib/dashboard/api-client', async (orig) => ({
  ...(await orig<object>()),
  useProposals: () => ({ data: { total: 0 } }),
  prefetchLeads: vi.fn(),
  prefetchProposals: vi.fn(),
}))
const workQueues = vi.fn((): { data: unknown } => ({ data: undefined }))
vi.mock('@/lib/dashboard/execution-api-client', () => ({ useWorkQueues: () => workQueues() }))
vi.mock('@/components/dashboard/QueryProvider', () => ({ QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/dashboard/CommandPalette', () => ({ CommandPalette: () => null }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@tanstack/react-query', async (orig) => ({ ...(await orig<object>()), useQueryClient: () => ({}) }))

import DashboardLayout from '@/app/(internal)/dashboard/layout'

describe('N3 — staff serial drafts are wiped on sign-out', () => {
  it('removes the staff register drafts (and leaves unrelated storage alone)', async () => {
    const key = `${STAFF_REGISTER_DRAFT_PREFIX}user_1-5`
    writeDraft(key, { rows: [{ serial: 'SN123' }] })
    window.localStorage.setItem('unrelated', 'keep')
    expect(readDraft(key)).not.toBeNull()
    render(<DashboardLayout><p>page</p></DashboardLayout>)
    await userEvent.setup().click(screen.getAllByTitle('Sign out')[0])
    expect(signOut).toHaveBeenCalled()
    expect(readDraft(key)).toBeNull()
    expect(window.localStorage.getItem('unrelated')).toBe('keep')
    clearAutosaveDraft(key)
  })

  it('the register panel stores its draft under that prefix', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    expect(readFileSync(resolve(__dirname, '../../components/dashboard/RegisterPanel.tsx'), 'utf8')).toContain('${STAFF_REGISTER_DRAFT_PREFIX}')
  })
})

describe('nav badges from GET /dashboard/work-queues', () => {
  it('shows "N awaiting" and a separate overdue badge — overdue is never added to the count', () => {
    workQueues.mockReturnValue({ data: { survey_reviews: { awaiting: 5, overdue: 2 }, survey_corrections: { pending: 3 } } })
    render(<DashboardLayout><p>page</p></DashboardLayout>)
    expect(screen.getAllByTestId('queue-badge-survey_reviews')[0]).toHaveTextContent('5')
    expect(screen.getAllByTestId('queue-badge-survey-overdue')[0]).toHaveTextContent('2 overdue')
    expect(screen.getAllByTestId('queue-badge-survey_corrections')[0]).toHaveTextContent('3')
    workQueues.mockReturnValue({ data: undefined })
  })
})
