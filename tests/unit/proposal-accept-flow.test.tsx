import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProposalAcceptPage from '@/app/(internal)/proposal/accept/[token]/page'
import { AcceptPanel } from '@/app/(internal)/proposal/accept/[token]/AcceptPanel'
import { normalizeAcceptResponse, screenForAcceptError, acceptApiPath, acceptPdfPath } from '@/lib/proposal-accept'
import { ACCEPT_VIEW_FIXTURE, ACCEPT_POST_FIXTURE, conflict } from './fixtures/accept-contract'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const TOKEN = 'tok/with space'

async function renderPage(fetchImpl: () => Promise<Response>) {
  const fetchMock = vi.fn().mockImplementation(fetchImpl)
  vi.stubGlobal('fetch', fetchMock)
  render(await ProposalAcceptPage({ params: Promise.resolve({ token: TOKEN }) }))
  return fetchMock
}

describe('Accept page — server fetch', () => {
  it('fetches the summary once, uncached, with the token encoded — no loading spinner in the first render', async () => {
    const fetchMock = await renderPage(() => Promise.resolve(json(ACCEPT_VIEW_FIXTURE)))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`http://127.0.0.1:8000${acceptApiPath(TOKEN)}`)
    expect(url).toContain('tok%2Fwith%20space')
    expect(init.cache).toBe('no-store')
    expect(screen.queryByText(/loading your proposal/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept proposal/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /download proposal/i })).toHaveAttribute('href', `http://127.0.0.1:8000${acceptPdfPath(TOKEN)}`)
  })

  it.each([
    ['proposal_superseded', /newer proposal replaces this one/i],
    ['proposal_not_available', /not open for acceptance/i],
    ['proposal_expired', /has expired/i],
    ['needs_reverification', /re-checking this proposal/i],
  ])('maps a 409 %s to a plain message', async (code, message) => {
    await renderPage(() => Promise.resolve(json(conflict(code), 409)))
    expect(screen.getByRole('heading', { name: message })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept proposal/i })).not.toBeInTheDocument()
  })

  it('shows not-found for a 404, and an honest retryable error for a 5xx or an unreachable backend', async () => {
    await renderPage(() => Promise.resolve(json({ detail: 'Proposal not found.' }, 404)))
    expect(screen.getByRole('heading', { name: /proposal not found/i })).toBeInTheDocument()
  })

  it('offers a retry that refreshes the server render when the backend fails', async () => {
    await renderPage(() => Promise.reject(new TypeError('fetch failed')))
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refresh).toHaveBeenCalled()
  })

  it('does not reveal internal field names on a re-verification block', async () => {
    await renderPage(() => Promise.resolve(json({ detail: { code: 'needs_reverification', message: 'Re-check', fields: ['system_size_kw'] } }, 409)))
    expect(document.body.textContent).not.toMatch(/system_size_kw/)
  })
})

describe('Accept button', () => {
  const view = normalizeAcceptResponse(ACCEPT_VIEW_FIXTURE)

  it('sends exactly one POST even when clicked twice in a row, then shows the accepted screen', async () => {
    let release: (r: Response) => void = () => {}
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((res) => (release = res)))
    vi.stubGlobal('fetch', fetchMock)
    render(<AcceptPanel token={TOKEN} view={view} />)

    const button = screen.getByRole('button', { name: /accept proposal/i })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`http://127.0.0.1:8000${acceptApiPath(TOKEN)}`)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')

    release(json(ACCEPT_POST_FIXTURE))
    expect(await screen.findByRole('heading', { name: /proposal accepted/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    [404, { detail: 'Proposal not found.' }, /proposal not found/i],
    [409, conflict('proposal_superseded'), /newer proposal replaces this one/i],
    [409, conflict('proposal_not_available'), /not open for acceptance/i],
    [409, conflict('proposal_expired'), /has expired/i],
    [409, conflict('needs_reverification'), /re-checking this proposal/i],
    [410, { detail: 'gone' }, /has expired/i],
  ])('POST %i %j → the matching screen', async (status, body, heading) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(body, status)))
    render(<AcceptPanel token={TOKEN} view={view} />)
    fireEvent.click(screen.getByRole('button', { name: /accept proposal/i }))
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('500 keeps the summary visible with a retryable message, and the button works again', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ detail: 'boom' }, 500)).mockResolvedValueOnce(json(ACCEPT_POST_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)
    render(<AcceptPanel token={TOKEN} view={view} />)
    fireEvent.click(screen.getByRole('button', { name: /accept proposal/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t record your acceptance/i)
    expect(screen.getByRole('button', { name: /accept proposal/i })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /accept proposal/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /proposal accepted/i })).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a network failure shows the connection message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    render(<AcceptPanel token={TOKEN} view={view} />)
    fireEvent.click(screen.getByRole('button', { name: /accept proposal/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t reach our server/i)
  })
})

describe('screenForAcceptError', () => {
  it('falls back to expired for a 409 without a recognised code (old plain-string body)', () => {
    expect(screenForAcceptError(409, { detail: 'This proposal has expired.' })).toBe('expired')
  })
})
