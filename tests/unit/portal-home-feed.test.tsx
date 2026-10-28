import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortalHome from '@/components/associate/PortalHome'
import CustomersList from '@/components/associate/CustomersList'
import { describeTodo, describeBlocked } from '@/lib/onboarding/todo'
import { nextStepKeyFromSummary } from '@/lib/onboarding/progress'
import { ApiError } from '@/lib/dashboard/api-error'
import { en, withI18n } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import type { HomeItem } from '@/lib/associate/home-api-client'
import type { Onboarding, ProgressSummary } from '@/lib/associate/onboarding-types'

const h = vi.hoisted(() => ({
  home: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  me: { data: { full_name: 'Asha Roy', associate_id: 'GNA-1', level: null, status: 'active' } as unknown, error: undefined as unknown },
  onboardings: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  progressCalls: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('@/lib/associate/home-api-client', () => ({ useAssociateHome: () => ({ ...h.home, refetch: h.refetch }) }))
vi.mock('@/lib/associate/api-client', () => ({ useAssociateMe: () => ({ ...h.me, refetch: h.refetch }) }))
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardings: () => ({ ...h.onboardings, refetch: h.refetch }),
  useOnboardingProgress: (...args: unknown[]) => h.progressCalls(...args),
}))
vi.mock('@/lib/commissions/associate-api-client', () => ({ useMyRate: () => ({ data: undefined, isLoading: false }) }))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 't' }), useClerk: () => ({ signOut: vi.fn() }) }))

const feed = en.associates.portal.feed
const stages = en.associates.portal.execution.stages
const item = (over: Partial<HomeItem> = {}): HomeItem => ({ kind: 'ready_to_submit', message_key: 'todo.ready_to_submit', onboarding_id: 5, customer_name: 'Bikash Das', priority: 1, params: {}, ...over })

beforeEach(() => {
  h.home = { data: { items: [], totals: { customers: 0, awaiting_grid_nova: 0, needing_action: 0 } } }
  h.me = { data: { full_name: 'Asha Roy', associate_id: 'GNA-1', level: null, status: 'active' }, error: undefined }
  h.onboardings = {}
  h.progressCalls.mockReset()
  h.refetch.mockReset()
})

const showHome = () => render(withI18n(<PortalHome copy={en.associates.portal.associate.home} feed={feed} stageNames={stages} portalBase="/associates/portal" />))

describe('describeTodo — the contract keys', () => {
  const cases: [HomeItem, string][] = [
    [item({ message_key: 'todo.documents_missing', params: { missing_documents: ['electricity_bill', 'id_proof'] } }), 'Documents still needed: Electricity bill, Id proof.'],
    [item({ message_key: 'todo.ready_to_submit' }), feed.todo.ready_to_submit],
    [item({ message_key: 'todo.stage_rejected', params: { stage: 'installed', stage_label: 'Installed', review_note: 'Photo is blurry' } }), 'Grid Nova sent back “Installation”. Photo is blurry'],
    [item({ message_key: 'todo.payment_overdue', params: { milestone_number: 2, label: 'Against Material Bill', outstanding: '300000.00', overdue: true } }), 'Payment overdue: Against Material Bill — ₹3,00,000.00 still to collect.'],
    [item({ message_key: 'todo.payment_due', params: { milestone_number: 1, label: 'On Order', outstanding: '100000.00', overdue: false } }), 'Payment due: On Order — ₹1,00,000.00 to collect.'],
    [item({ message_key: 'todo.formal_proposal_ready' }), feed.todo.formal_proposal_ready],
    [item({ message_key: 'todo.upload_signed_agreement' }), feed.todo.upload_signed_agreement],
    [item({ message_key: 'todo.execution_next_step', params: { stage: 'commissioned', stage_label: 'Commissioned' } }), 'Next installation step: Commissioning.'],
    [item({ message_key: 'todo.receipt_available', params: { receipt_number: 'GNR-2026-000001' } }), 'Receipt GNR-2026-000001 is ready for the customer.'],
  ]
  it.each(cases)('translates %# without leaking its key', (it_, expected) => {
    const text = describeTodo(it_, feed, stages)
    expect(text).toBe(expected)
    expect(text).not.toContain('todo.')
  })

  it('falls back to a safe generic line for an unknown key, never showing the raw key', () => {
    const text = describeTodo(item({ message_key: 'todo.brand_new_thing', params: { x: 1 } }), feed, stages)
    expect(text).toBe(feed.todo.generic)
    expect(text).not.toMatch(/brand_new/)
  })

  it('uses the API stage label when the stage has no translation', () => {
    expect(describeTodo(item({ message_key: 'todo.execution_next_step', params: { stage: 'new_stage', stage_label: 'New stage' } }), feed, stages)).toBe('Next installation step: New stage.')
  })

  it('has every key in English, Hindi and Bengali (key parity)', () => {
    const keys = Object.keys(en.associates.portal.feed.todo).sort()
    expect(Object.keys(hi.associates.portal.feed.todo).sort()).toEqual(keys)
    expect(Object.keys(bn.associates.portal.feed.todo).sort()).toEqual(keys)
    expect(keys).toEqual(['commission_payout_paid', 'commission_query_answered', 'commission_rate_changed', 'commission_rate_cleared', 'commission_rate_starts', 'documents_missing', 'execution_next_step', 'formal_proposal_ready', 'generic', 'handover_pending', 'party_associate', 'party_customer', 'payment_due', 'payment_overdue', 'ready_to_submit', 'receipt_available', 'service_request_closed', 'service_request_open', 'site_location_missing', 'site_location_unconfirmed', 'stage_rejected', 'survey_resign_needed', 'survey_revisit_correction', 'survey_revisit_edit', 'upload_signed_agreement'])
  })

  it('translates in Hindi and Bengali too', () => {
    const hiFeed = hi.associates.portal.feed
    expect(describeTodo(item({ message_key: 'todo.upload_signed_agreement' }), hiFeed as typeof feed, hi.associates.portal.execution.stages)).toBe(hiFeed.todo.upload_signed_agreement)
    expect(describeTodo(item({ message_key: 'todo.payment_due', params: { label: 'ऑर्डर पर', outstanding: '100000.00' } }), hiFeed as typeof feed, {})).toContain('₹1,00,000.00')
  })
})

describe('describeBlocked / progress_summary.blocked', () => {
  it('maps the three contract reasons, with a generic fallback', () => {
    expect(describeBlocked('formal_proposal_blocked', feed)).toBe(feed.blocked.formal_proposal_blocked)
    expect(describeBlocked('payment_gate', feed)).toBe(feed.blocked.payment_gate)
    expect(describeBlocked('dcr_mismatch', feed)).toBe(feed.blocked.dcr_mismatch)
    expect(describeBlocked('something_else', feed)).toBe(feed.blocked.generic)
  })
})

describe('PortalHome — the to-do feed', () => {
  it('renders big cards in the order the server sent, with translated sentences and links to the right place', () => {
    h.home = {
      data: {
        items: [
          item({ priority: 1, message_key: 'todo.payment_overdue', kind: 'payment_due', onboarding_id: 7, customer_name: 'Chitra', params: { label: 'On Order', outstanding: '100000.00' } }),
          item({ priority: 1, message_key: 'todo.stage_rejected', kind: 'stage_rejected', onboarding_id: 8, customer_name: 'Dev', params: { stage: 'installed', review_note: 'Redo' } }),
          item({ priority: 2, message_key: 'todo.upload_signed_agreement', kind: 'upload_signed_agreement', onboarding_id: 9, customer_name: 'Esha' }),
          item({ priority: 3, message_key: 'todo.mystery', kind: 'x', onboarding_id: 10, customer_name: 'Farid' }),
        ],
        totals: { customers: 4, awaiting_grid_nova: 1, needing_action: 3 },
      },
    }
    showHome()
    const cards = screen.getAllByTestId('todo-card')
    expect(cards.map((c) => c.getAttribute('data-priority'))).toEqual(['1', '1', '2', '3'])
    expect(cards[0]).toHaveTextContent('Chitra')
    expect(cards[0]).toHaveTextContent('₹1,00,000.00')
    expect(cards[0]).toHaveAttribute('href', '/associates/portal/customers/7/payments')
    expect(cards[1]).toHaveAttribute('href', '/associates/portal/customers/8/execution')
    expect(cards[2]).toHaveAttribute('href', '/associates/portal/customers/9')
    expect(cards[3]).toHaveTextContent(feed.todo.generic)
    expect(document.body.textContent).not.toMatch(/todo\.(payment|stage|upload|mystery)/)
    expect(screen.getByTestId('home-totals')).toHaveTextContent('3')
  })

  it('shows "all caught up" with one large Add customer button when there is nothing to do', () => {
    showHome()
    const empty = screen.getByTestId('caught-up')
    expect(empty).toHaveTextContent(feed.caughtUpTitle)
    const add = within(empty).getByRole('link', { name: new RegExp(feed.addCustomer) })
    expect(add).toHaveAttribute('href', '/associates/portal/customers/new')
    expect(add.className).toMatch(/min-h-\[56px\]/)
  })

  it('pins the primary Add customer action when there are to-dos', () => {
    h.home = { data: { items: [item()], totals: { customers: 1, awaiting_grid_nova: 0, needing_action: 1 } } }
    showHome()
    expect(within(screen.getByTestId('pinned-action')).getByRole('link', { name: new RegExp(feed.addCustomer) })).toBeInTheDocument()
  })

  it('shows a skeleton while loading and an error with Retry', async () => {
    h.home = { isLoading: true }
    const { unmount } = showHome()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    unmount()
    h.home = { error: new ApiError(500, 'x', 'boom') }
    showHome()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(h.refetch).toHaveBeenCalled()
  })
})

const summary = (over: Partial<ProgressSummary> = {}): ProgressSummary => ({
  current_stage: 'accepted', stage_label: 'Accepted', next_stage: 'agreement_signed', next_stage_label: 'Agreement signed', needs_action: false, action_kinds: [], blocked: null, ...over,
})

const customer = (id: number, name: string, over: Partial<Onboarding> = {}): Onboarding =>
  ({ onboarding_id: id, customer: { name, mobile: '9800000000', email: null }, score: null, formal_proposal_blocked: null, progress_summary: summary(), ...over }) as Onboarding

const showList = () =>
  render(withI18n(<CustomersList copy={en.associates.portal.customers} nextStepCopy={en.associates.portal.shared.nextStep} actionNeededLabel={feed.actionNeeded} portalBase="/associates/portal" />))

describe('CustomersList — progress_summary, no per-card requests', () => {
  it('reads each card from progress_summary and never requests progress per customer', () => {
    h.onboardings = {
      data: {
        items: [
          customer(1, 'A'),
          customer(2, 'B', { progress_summary: summary({ needs_action: true, action_kinds: ['documents_missing'], next_stage: 'accepted' }) }),
          customer(3, 'C', { progress_summary: summary({ blocked: { reason: 'payment_gate' } }) }),
          customer(4, 'D', { progress_summary: summary({ action_kinds: ['stage_rejected'] }) }),
        ],
        page: 1, page_size: 50, total: 4,
      },
    }
    showList()
    expect(h.progressCalls).not.toHaveBeenCalled()
    const text = document.body.textContent ?? ''
    expect(text).toContain(en.associates.portal.shared.nextStep.agreement_signed ?? '')
    expect(text).toContain(en.associates.portal.shared.nextStep.blockedPaymentGate)
    expect(text).toContain(en.associates.portal.shared.nextStep.executionRejected)
    expect(screen.getAllByTestId('action-needed')).toHaveLength(1)
  })

  it('a card without a summary (older response) simply shows no next-step line', () => {
    h.onboardings = { data: { items: [customer(1, 'A', { progress_summary: undefined })], page: 1, page_size: 50, total: 1 } }
    showList()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(h.progressCalls).not.toHaveBeenCalled()
  })

  it('pins the Add customer button for phones', () => {
    h.onboardings = { data: { items: [], page: 1, page_size: 50, total: 0 } }
    showList()
    expect(within(screen.getByTestId('pinned-action')).getByRole('link', { name: new RegExp(en.associates.portal.customers.addButton) })).toBeInTheDocument()
  })

  it('shows a skeleton while loading', () => {
    h.onboardings = { isLoading: true }
    showList()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })
})

describe('nextStepKeyFromSummary', () => {
  it('prefers the detailed formal-proposal block, then a blocked reason, then a rejection, then the next stage', () => {
    const blocked = { reason: 'draft_failed' } as Onboarding['formal_proposal_blocked']
    expect(nextStepKeyFromSummary(summary({ blocked: { reason: 'dcr_mismatch' } }), blocked)).toBe('blockedDraftFailed')
    expect(nextStepKeyFromSummary(summary({ blocked: { reason: 'dcr_mismatch' } }), null)).toBe('blockedDcrMismatch')
    expect(nextStepKeyFromSummary(summary({ blocked: { reason: 'brand_new' } }), null)).toBe('blockedGeneric')
    expect(nextStepKeyFromSummary(summary({ action_kinds: ['stage_rejected'] }), null)).toBe('executionRejected')
    expect(nextStepKeyFromSummary(summary(), null)).toBe('agreement_signed')
    expect(nextStepKeyFromSummary(summary({ next_stage: null }), null)).toBe('none')
    expect(nextStepKeyFromSummary(undefined, null)).toBeNull()
  })
})
