import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/dashboard/api-error'
import HandoverView from '@/app/(internal)/handover/[token]/HandoverView'
import HandoverPage from '@/app/(internal)/handover/[token]/page'
import { metadata } from '@/app/(internal)/handover/[token]/layout'
import robots from '@/app/robots'
import { isBareRoute } from '@/components/SiteChrome'
import { isUnlocalizedPath, localizeHref } from '@/lib/i18n/config'
import { NO_FRAME_SOURCES, securityHeaders } from '@/lib/security-headers'
import { loadPublicHandover, loadPublicRequests, publicPdfHref } from '@/lib/handover/public'
import { PUBLIC_HANDOVER } from './fixtures/handover-contract'

const h = vi.hoisted(() => ({ publicFetch: vi.fn(), load: vi.fn(), loadRequests: vi.fn() }))
vi.mock('@/lib/api/http', async (orig) => ({ ...(await orig<typeof import('@/lib/api/http')>()), publicFetch: (...a: unknown[]) => h.publicFetch(...a) }))
vi.mock('@/lib/handover/public', async (orig) => {
  const real = await orig<typeof import('@/lib/handover/public')>()
  return { ...real, loadPublicHandover: (...a: unknown[]) => h.load(...a), loadPublicRequests: (...a: unknown[]) => h.loadRequests(...a) }
})
vi.mock('@/lib/config', () => ({ API_BASE_URL: 'https://api.gridnova.test' }))
vi.mock('next/image', () => ({ default: (p: { alt: string }) => <span role="img" aria-label={p.alt} /> }))

// A customer-view request: the backend leaves out raised_by, assignee, phone, photos and history.
const customerView = (over = {}) => ({ request_id: 31, category: 'no_generation', description: 'No power since the storm.', status: 'open', created_at: '2026-11-02T05:00:00Z', closed_at: null, resolution_note: null, within_warranty: true, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  h.publicFetch.mockResolvedValue({ items: [] })
  h.load.mockResolvedValue({ screen: 'ready', view: PUBLIC_HANDOVER })
  h.loadRequests.mockResolvedValue([])
})

const show = (initial: unknown = []) => render(<HandoverView token="TOK123" view={PUBLIC_HANDOVER} initialRequests={initial as never} />)

describe('public handover page (W9)', () => {
  it('shows the system, warranty dates, equipment and the PDF link — and nothing needing a sign-in', () => {
    show()
    const page = screen.getByTestId('public-handover')
    expect(page).toHaveTextContent('Welcome, Bikash Das')
    expect(page).toHaveTextContent('GNE-WB-RES-2026-00012')
    expect(page).toHaveTextContent('5.40 kW')
    const w = screen.getByTestId('public-warranty')
    expect(w).toHaveTextContent('5 years — 12 Oct 2026 to 12 Oct 2031')
    expect(w).toHaveTextContent('In warranty')
    expect(screen.getAllByTestId('public-unit')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Download your handover pack/ })).toHaveAttribute('href', 'https://api.gridnova.test/api/v1/public/handover/TOK123/pdf')
    expect(screen.queryByText(/sign in|log in|password/i)).toBeNull()
  })

  it('labels unconfirmed warranty values “To be confirmed” and never invents them', () => {
    show()
    const w = screen.getByTestId('public-warranty')
    expect(within(w).getAllByText('To be confirmed').length).toBeGreaterThanOrEqual(2)
    expect(w).toHaveTextContent('Warranty date to be confirmed')
    expect(w).not.toHaveTextContent(/25 years/)
  })

  it('has no download link while the PDF is not available', () => {
    render(<HandoverView token="T" view={{ ...PUBLIC_HANDOVER, pdf_available: false }} initialRequests={[]} />)
    expect(screen.queryByRole('link', { name: /Download your handover pack/ })).toBeNull()
    expect(screen.getByTestId('pdf-pending')).toBeInTheDocument()
  })

  it('shows the service contact and an SLA only when the backend has one', () => {
    show()
    expect(screen.getByTestId('service-contact')).toHaveTextContent('service@gridnova.in')
    expect(screen.queryByText(/We aim to resolve/)).toBeNull()
    render(<HandoverView token="T" view={{ ...PUBLIC_HANDOVER, service: { ...PUBLIC_HANDOVER.service, sla_hours: 48 } }} initialRequests={[]} />)
    expect(screen.getByText('We aim to resolve a request within 48 hours.')).toBeInTheDocument()
  })

  it('lists only the customer-view fields of earlier requests', () => {
    show([customerView({ resolution_note: 'Replaced the fuse', status: 'resolved' })])
    const item = screen.getByTestId('public-request')
    expect(item).toHaveTextContent('No generation')
    expect(item).toHaveTextContent('Resolved')
    expect(item).toHaveTextContent('Outcome: Replaced the fuse')
    // staff-only data is not part of this view and nothing here asks for it
    expect(screen.queryByText(/assignee|raised_by|history|internal/i)).toBeNull()
  })

  it('says so when the earlier requests could not be loaded', () => {
    render(<HandoverView token="T" view={PUBLIC_HANDOVER} initialRequests={null} />)
    expect(screen.getByText('We could not load your earlier requests.')).toBeInTheDocument()
  })

  it('raises a request through the token’s own URL, as multipart with no Authorization header', async () => {
    h.publicFetch.mockImplementation(async (path: string, init?: RequestInit) => (init?.method === 'POST' ? undefined : { items: [customerView()] }))
    show()
    await userEvent.selectOptions(screen.getByLabelText(/What is the problem/), 'no_generation')
    await userEvent.type(screen.getByLabelText(/Describe the problem/), 'No power')
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    await waitFor(() => expect(h.publicFetch).toHaveBeenCalled())
    const post = h.publicFetch.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')!
    expect(post[0]).toBe('/api/v1/public/handover/TOK123/service-requests')
    const init = post[1] as RequestInit
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('category')).toBe('no_generation')
    expect(init.headers).toBeUndefined() // no Authorization, and no JSON content type that would break the multipart boundary
    expect(await screen.findByText('Your service request was sent.')).toBeInTheDocument()
    expect(await screen.findByTestId('public-request')).toBeInTheDocument() // the list refreshed
  })

  it.each([
    [429, 'You have sent several requests recently. Please wait a few minutes and try again, or call us.'],
    [404, 'This link is no longer valid. Please contact Grid Nova for a new one.'],
  ])('a %s from the server is explained in words', async (status, message) => {
    h.publicFetch.mockRejectedValue(new ApiError(status, 'x', 'x'))
    show()
    await userEvent.selectOptions(screen.getByLabelText(/What is the problem/), 'other')
    await userEvent.type(screen.getByLabelText(/Describe the problem/), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Send service request' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('uses the API’s photo limit and category list', () => {
    render(<HandoverView token="T" view={{ ...PUBLIC_HANDOVER, service: { ...PUBLIC_HANDOVER.service, max_photos: 3, categories: ['no_generation', 'other'] } }} initialRequests={[]} />)
    expect(screen.getByText('Up to 3 photos.')).toBeInTheDocument()
    const options = within(screen.getByLabelText(/What is the problem/)).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Choose…', 'The system is not generating', 'Something else'])
  })
})

describe('public handover page — unusable links and privacy', () => {
  it('an unknown, revoked or expired token (404) shows a plain page with no customer data', async () => {
    h.load.mockResolvedValue({ screen: 'notfound', view: null })
    h.loadRequests.mockResolvedValue(null)
    render(await HandoverPage({ params: Promise.resolve({ token: 'dead' }) }))
    expect(screen.getByRole('heading', { name: 'This link is not valid' })).toBeInTheDocument()
    expect(screen.queryByTestId('public-handover')).toBeNull()
    expect(screen.queryByText(/Bikash/)).toBeNull()
  })

  it.each([
    ['ratelimited', 'Please try again in a minute'],
    ['error', 'We could not load this page'],
  ])('%s is an honest message, not an empty page', async (screenName, title) => {
    h.load.mockResolvedValue({ screen: screenName, view: null })
    render(await HandoverPage({ params: Promise.resolve({ token: 't' }) }))
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('a good token renders the page with the requests fetched alongside it', async () => {
    h.loadRequests.mockResolvedValue([customerView()])
    render(await HandoverPage({ params: Promise.resolve({ token: 'good' }) }))
    expect(screen.getByTestId('public-handover')).toBeInTheDocument()
    expect(screen.getByTestId('public-request')).toBeInTheDocument()
    expect(h.load).toHaveBeenCalledWith('good')
    expect(h.loadRequests).toHaveBeenCalledWith('good')
  })

  it('is marked noindex and nofollow', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('is disallowed in robots.txt', () => {
    const rules = robots().rules as { disallow: string[] }
    expect(rules.disallow).toContain('/handover/')
  })

  it('has no marketing chrome, no locale prefix, no framing and no Referer leak', () => {
    expect(isBareRoute('/handover/TOK123', false)).toBe(true)
    expect(isUnlocalizedPath('/handover/TOK123')).toBe(true)
    expect(localizeHref('/handover/TOK123', 'hi')).toBe('/handover/TOK123')
    expect(NO_FRAME_SOURCES).toContain('/handover/:path*')
    const rule = securityHeaders({ dev: false, reportOnly: false, apiOrigin: 'https://api.gridnova.test' } as never).find((r) => r.source === '/handover/:path*' && r.headers.some((x) => x.key === 'Referrer-Policy'))
    expect(rule?.headers.find((x) => x.key === 'Referrer-Policy')?.value).toBe('no-referrer')
  })
})

describe('server loader', () => {
  const real = async () => (await vi.importActual<typeof import('@/lib/handover/public')>('@/lib/handover/public'))
  const respond = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))

  it('maps 404 / 429 / 5xx / a malformed body / a network failure to honest screens', async () => {
    const { loadPublicHandover: load } = await real()
    respond(404, { detail: 'Not found' })
    expect((await load('x')).screen).toBe('notfound')
    respond(429, {})
    expect((await load('x')).screen).toBe('ratelimited')
    respond(500, {})
    expect((await load('x')).screen).toBe('error')
    respond(200, { not: 'the contract' })
    expect((await load('x')).screen).toBe('error')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    expect((await load('x')).screen).toBe('error')
    vi.unstubAllGlobals()
  })

  it('reads a good body, asks for no caching, and URL-encodes the token', async () => {
    const { loadPublicHandover: load } = await real()
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(PUBLIC_HANDOVER), { status: 200 }))
    vi.stubGlobal('fetch', f)
    const r = await load('a/b')
    expect(r.screen).toBe('ready')
    expect(f.mock.calls[0][0]).toBe('https://api.gridnova.test/api/v1/public/handover/a%2Fb')
    expect(f.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
    vi.unstubAllGlobals()
  })

  it('the PDF link points at the API with the token', () => {
    expect(publicPdfHref('T1')).toBe('https://api.gridnova.test/api/v1/public/handover/T1/pdf')
    expect(loadPublicHandover).toBeDefined()
    expect(loadPublicRequests).toBeDefined()
  })
})
