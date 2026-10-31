import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortalHandover from '@/components/associate/PortalHandover'
import { ApiError } from '@/lib/dashboard/api-error'
import { describeTodo, todoHref } from '@/lib/onboarding/todo'
import type { HomeItem } from '@/lib/associate/home-api-client'
import { en, withI18n } from './helpers/i18n'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { HANDED_OVER_PACK, makePack, makeRequest } from './fixtures/handover-contract'

const h = vi.hoisted(() => ({
  pack: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  requests: {} as { data?: unknown; error?: unknown; isLoading?: boolean },
  raise: vi.fn(),
  pdf: vi.fn(),
  search: '',
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(h.search), useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }))
vi.mock('@/lib/handover/associate-api-client', () => ({
  useMyHandoverPack: () => ({ refetch: vi.fn(), ...h.pack }),
  useMyServiceRequests: () => ({ refetch: vi.fn(), ...h.requests }),
  useRaiseMyServiceRequest: () => ({ mutateAsync: h.raise }),
  fetchMyHandoverPdfLink: (...a: unknown[]) => h.pdf(...a),
}))

const copy = en.associates.portal.handover
const words = en.associates.portal.feed.service
const owner = (over = {}) => makePack({ ...HANDED_OVER_PACK, can_raise_service_request: true, ...over })

function show(c = copy, w = words) {
  return render(withI18n(<PortalHandover onboardingId={12} portalBase="/associates/portal" copy={c} words={w} />))
}

let open: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  h.search = ''
  h.pack = { data: owner() }
  h.requests = { data: { items: [makeRequest()], can_raise: true } }
  open = vi.fn()
  vi.stubGlobal('open', open)
  h.pdf.mockResolvedValue({ url: 'https://files.example/pack.pdf?sig=1' })
})
afterEach(() => vi.unstubAllGlobals())

describe('Associate: handover pack and warranty (W7)', () => {
  it('shows pack items in the associate’s words and says when handed over', () => {
    show()
    expect(screen.getByTestId('pack-card')).toHaveTextContent('Handed over to the customer.')
    expect(screen.getByTestId('pack-item-orientation')).toHaveTextContent('Customer orientation given')
    expect(screen.queryByText('orientation')).toBeNull() // never the raw key
  })

  it('before handover lists what is still to do and links to the installation steps', () => {
    h.pack = { data: makePack({ can_raise_service_request: true }) }
    show()
    expect(screen.getByTestId('pack-card')).toHaveTextContent('4 of 7 done')
    expect(screen.getByTestId('pack-item-orientation')).toHaveAttribute('data-done', 'false')
    expect(screen.getByRole('link', { name: 'Open the installation steps' })).toHaveAttribute('href', '/associates/portal/customers/12/execution')
    expect(screen.getByTestId('not-handed-over')).toBeInTheDocument()
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('shows warranty dates and labels unconfirmed values instead of inventing them', () => {
    show()
    const card = screen.getByTestId('warranty-card')
    expect(card).toHaveTextContent('5 years: 12 Oct 2026 to 12 Oct 2031')
    expect(card).toHaveTextContent('In warranty')
    expect(card).toHaveTextContent('12 months, until 12 Oct 2027')
    expect(within(card).getAllByTestId('unconfirmed').length).toBeGreaterThanOrEqual(1) // panel life
    // FE-22b: O&M after year 1 not yet given → a promise of details, never an empty or "unconfirmed" box.
    expect(card).toHaveTextContent('Details will be shared by Grid Nova.')
    expect(card).toHaveTextContent('Serial MOD-001')
    expect(card).toHaveTextContent('No warranty date') // the inverter
    expect(card).not.toHaveTextContent(/20 years|25 years/)
  })

  it('downloads the pack through a fresh signed link on each click', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Download the PDF' }))
    await userEvent.click(screen.getByRole('button', { name: 'Download the PDF' }))
    await waitFor(() => expect(h.pdf).toHaveBeenCalledTimes(2))
    expect(h.pdf).toHaveBeenCalledWith(12, 'tok')
    expect(open).toHaveBeenCalledWith('https://files.example/pack.pdf?sig=1', '_blank', 'noopener')
  })

  it('says the PDF is not ready (a 404) instead of failing silently', async () => {
    h.pdf.mockRejectedValue(new ApiError(404, 'x', 'Not found'))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Download the PDF' }))
    expect(await screen.findByText(/The PDF is not ready yet/)).toBeInTheDocument()
  })

  it('no download button while the PDF is held or not generated', () => {
    h.pack = { data: owner({ pdf: { status: 'held', held_reason: 'placeholder', generated_at: null } }) }
    show()
    expect(screen.queryByRole('button', { name: 'Download the PDF' })).toBeNull()
    expect(screen.getByTestId('pdf-not-ready')).toBeInTheDocument()
    expect(screen.queryByText('placeholder')).toBeNull() // staff-facing reason is not shown to associates
  })

  it('explains a project whose installation has not started', () => {
    h.pack = { error: new ApiError(409, 'x', 'x', { code: 'execution_not_started' }) }
    show()
    expect(screen.getByTestId('not-started')).toHaveTextContent('Installation has not started')
  })
})

describe('Associate: service requests (W7)', () => {
  it('lists requests with translated category, status and the within-warranty badge', () => {
    show()
    const item = screen.getByTestId('service-request-item')
    expect(item).toHaveTextContent('#31 · No generation')
    expect(item).toHaveTextContent('Open')
    expect(within(item).getByTestId('within-warranty')).toBeInTheDocument()
  })

  it('shows out-of-warranty, and no badge at all when the warranty is unknown', () => {
    h.requests = { data: { items: [makeRequest({ request_id: 1, within_warranty: false }), makeRequest({ request_id: 2, within_warranty: null })] } }
    show()
    expect(screen.getAllByTestId('out-of-warranty')).toHaveLength(1)
    expect(screen.queryAllByTestId('within-warranty')).toHaveLength(0)
  })

  it('the owner can raise a request', async () => {
    h.raise.mockResolvedValue(makeRequest())
    show()
    await userEvent.selectOptions(screen.getByLabelText(/What is the problem/), 'physical_damage')
    await userEvent.type(screen.getByLabelText(/Describe the problem/), 'Cracked panel')
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    await waitFor(() => expect(h.raise).toHaveBeenCalledWith({ category: 'physical_damage', description: 'Cracked panel', contact_phone: '', files: [] }))
    expect(await screen.findByText('The service request was sent.')).toBeInTheDocument()
  })

  it('a territory Preferred Associate sees the requests but not the form', () => {
    h.pack = { data: owner({ can_raise_service_request: false }) }
    show()
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.getByTestId('owner-only')).toHaveTextContent('Only the customer’s owner')
    expect(screen.getByTestId('service-request-item')).toBeInTheDocument()
  })

  it('translates the server’s refusal by code, never showing its English', async () => {
    h.raise.mockRejectedValue(new ApiError(422, 'x', 'Too many photos supplied', { code: 'too_many_photos' }))
    show()
    await userEvent.selectOptions(screen.getByLabelText(/What is the problem/), 'other')
    await userEvent.type(screen.getByLabelText(/Describe the problem/), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    expect(await screen.findByText('Too many photos. Remove some and try again.')).toBeInTheDocument()
    expect(screen.queryByText('Too many photos supplied')).toBeNull()
  })

  it('highlights the request named in the link from the home feed', () => {
    h.search = 'request=31'
    show()
    expect(screen.getByTestId('service-request-item').className).toMatch(/ring-2/)
  })

  it('an empty list says so', () => {
    h.requests = { data: { items: [] } }
    show()
    expect(screen.getByTestId('no-requests')).toBeInTheDocument()
  })

  it('a backend failure on the list is an error card, not an empty list', () => {
    h.requests = { error: new ApiError(0, 'Network request failed') }
    show()
    expect(screen.getByText(/Couldn't reach Grid Nova/)).toBeInTheDocument()
    expect(screen.queryByTestId('no-requests')).toBeNull()
  })
})

describe('Associate: Hindi and Bengali', () => {
  it.each([
    ['hi', hi.associates.portal, 'हैंडओवर और वारंटी'],
    ['bn', bn.associates.portal, 'হ্যান্ডওভার ও ওয়ারেন্টি'],
  ])('%s renders translated pack, warranty and form copy', (_l, portal, title) => {
    h.pack = { data: owner() }
    show(portal.handover as typeof copy, portal.feed.service as typeof words)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
    expect(screen.getByTestId('pack-item-orientation')).toHaveTextContent((portal.handover.pack.items as Record<string, string>).orientation)
    expect(screen.getByLabelText(new RegExp(portal.handover.form.category.replace('?', '\\?')))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: portal.handover.form.submit })).toBeInTheDocument()
  })
})

describe('Associate home to-dos for the handover keys (W8)', () => {
  const feed = en.associates.portal.feed
  const stages = en.associates.portal.execution.stages
  const base = { onboarding_id: 12, customer_name: 'Bikash Das', priority: 3 as const }
  const pending: HomeItem = { ...base, kind: 'handover_pending', message_key: 'todo.handover_pending', params: {} }
  const open: HomeItem = { ...base, kind: 'service_request_open', message_key: 'todo.service_request_open', params: { request_id: 31, category: 'no_generation', status: 'in_progress', within_warranty: true } }
  const closed: HomeItem = { ...base, kind: 'service_request_closed', message_key: 'todo.service_request_closed', params: { request_id: 31, category: 'inverter_error', outcome: 'resolved' } }

  it('describes them in words, with category and status translated', () => {
    expect(describeTodo(pending, feed, stages)).toBe('Installation is commissioned. Handover to the customer is still pending.')
    expect(describeTodo(open, feed, stages)).toBe('Service request (No generation) is being worked on. Within warranty.')
    expect(describeTodo(closed, feed, stages)).toBe('Service request (Inverter error) was resolved.')
    expect(describeTodo(closed, hi.associates.portal.feed as typeof feed, stages)).toContain('इन्वर्टर में त्रुटि')
    expect(describeTodo(open, bn.associates.portal.feed as typeof feed, stages)).toContain('বিদ্যুৎ তৈরি হচ্ছে না')
  })

  it('out of warranty / unknown warranty / unknown category never show raw keys', () => {
    expect(describeTodo({ ...open, params: { ...open.params, within_warranty: false } }, feed, stages)).toContain('Out of warranty.')
    expect(describeTodo({ ...open, params: { ...open.params, within_warranty: null } }, feed, stages)).not.toMatch(/warranty/i)
    expect(describeTodo({ ...open, params: { request_id: 31, within_warranty: null, category: 'wind_damage', status: 'weird_state' } }, feed, stages)).toBe('Service request (Wind damage) is Weird state.')
  })

  it('links each to the handover page, naming the request when there is one', () => {
    expect(todoHref(pending, '/associates/portal')).toBe('/associates/portal/customers/12/handover')
    expect(todoHref(open, '/preferred/portal')).toBe('/preferred/portal/customers/12/handover?request=31')
  })
})
