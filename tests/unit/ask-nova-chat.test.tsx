import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AskNova from '@/components/AskNova'
import { withI18n, en } from './helpers/i18n'
import { nextRevealLength, REVEAL_MAX_MS, REVEAL_TICK_MS, readSessionToken, writeSessionToken } from '@/lib/ask-nova/chat'
import { CHAT_REPLY_FIXTURE, CHAT_REMOVED_FIELDS } from './fixtures/chat-contract'

const reply = (over: Partial<typeof CHAT_REPLY_FIXTURE> = {}) =>
  new Response(JSON.stringify({ ...CHAT_REPLY_FIXTURE, ...over }), { status: 200 })

function reducedMotion() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

async function openPanel() {
  render(withI18n(<AskNova />))
  fireEvent.click(screen.getByRole('button', { name: en.nova.open }))
  return screen.findByRole('textbox', { name: en.nova.inputLabel })
}

// The reply also sits in a screen-reader-only status region, so scope to the log.
// 5 s, not the 1 s default: the reply reveal can take longer on a loaded CI runner.
const findReply = () => within(screen.getByRole('log')).findByText(CHAT_REPLY_FIXTURE.reply, {}, { timeout: 5000 })

async function send(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

const sentBody = (fetchMock: ReturnType<typeof vi.fn>, call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body as string)

beforeEach(() => {
  reducedMotion()
  sessionStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Ask Nova — session token contract (BE-1 §1)', () => {
  it('sends only the message first, then only message + session_token, never ids', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply()))
    vi.stubGlobal('fetch', fetchMock)
    const input = await openPanel()

    await send(input, 'Hello')
    await findReply()
    await send(input, 'And pricing?')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(sentBody(fetchMock, 0)).toEqual({ message: 'Hello' })
    expect(sentBody(fetchMock, 1)).toEqual({ message: 'And pricing?', session_token: CHAT_REPLY_FIXTURE.session_token })
    for (const key of CHAT_REMOVED_FIELDS) {
      expect(sentBody(fetchMock, 0)).not.toHaveProperty(key)
      expect(sentBody(fetchMock, 1)).not.toHaveProperty(key)
    }
    expect(sessionStorage.getItem('nova_session_token')).toBe(CHAT_REPLY_FIXTURE.session_token)
  })

  it('clears legacy id keys and never sends or stores them', async () => {
    sessionStorage.setItem('nova_lead_id', '12')
    sessionStorage.setItem('nova_customer_id', '7')
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply()))
    vi.stubGlobal('fetch', fetchMock)
    const input = await openPanel()
    await send(input, 'Hello')
    await findReply()
    expect(sentBody(fetchMock)).toEqual({ message: 'Hello' })
    expect(sessionStorage.getItem('nova_lead_id')).toBeNull()
    expect(sessionStorage.getItem('nova_customer_id')).toBeNull()
  })

  it('resumes the stored token on a fresh page load', async () => {
    writeSessionToken('stored-token')
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply()))
    vi.stubGlobal('fetch', fetchMock)
    const input = await openPanel()
    await send(input, 'Hello again')
    await findReply()
    expect(sentBody(fetchMock)).toEqual({ message: 'Hello again', session_token: 'stored-token' })
  })

  it('shows a valid reply even when sessionStorage throws on every access', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply()))
    vi.stubGlobal('fetch', fetchMock)
    const input = await openPanel()
    await send(input, 'Hello')
    expect(await findReply()).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    // The in-memory token still carries the conversation.
    await send(input, 'Next')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(sentBody(fetchMock, 1).session_token).toBe(CHAT_REPLY_FIXTURE.session_token)
  })

  it('storage helpers swallow errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('x')
    })
    expect(readSessionToken()).toBeNull()
    expect(() => writeSessionToken('t')).not.toThrow()
  })
})

describe('Ask Nova — input behaviour', () => {
  it('does not send on an Enter that commits an IME candidate', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reply()))
    vi.stubGlobal('fetch', fetchMock)
    const input = await openPanel()
    fireEvent.change(input, { target: { value: 'नमस्ते' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('keeps the textarea enabled (readOnly + aria-busy) while sending so focus is not lost', async () => {
    let release: (r: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((res) => (release = res))))
    const input = (await openPanel()) as HTMLTextAreaElement
    input.focus()
    await send(input, 'Hello')
    await waitFor(() => expect(input).toHaveAttribute('aria-busy', 'true'))
    expect(input).not.toBeDisabled()
    expect(input.readOnly).toBe(true)
    expect(document.activeElement).toBe(input)
    release(reply())
    await findReply()
    expect(input).toHaveAttribute('aria-busy', 'false')
    expect(input.readOnly).toBe(false)
  })

  it('uses a 16px-or-larger text size on the input (no iOS zoom)', async () => {
    const input = await openPanel()
    expect(input.className).toMatch(/\btext-base\b/)
  })
})

describe('Ask Nova — failure copy', () => {
  const failWith = async (response: () => Promise<Response>) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response))
    const input = await openPanel()
    await send(input, 'Hello')
    return screen.findByRole('alert')
  }

  it('429 → rate-limit copy', async () => {
    const alert = await failWith(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Rate limit exceeded.' }), { status: 429 })))
    expect(alert).toHaveTextContent(en.nova.errorRateLimit)
  })
  it('5xx → server copy', async () => {
    const alert = await failWith(() => Promise.resolve(new Response('Bad gateway', { status: 502 })))
    expect(alert).toHaveTextContent(en.nova.errorServer)
  })
  it('network failure → network copy', async () => {
    const alert = await failWith(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(alert).toHaveTextContent(en.nova.errorNetwork)
  })
  it('anything else → the generic copy', async () => {
    const alert = await failWith(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Message exceeds 2000 character limit.' }), { status: 422 })))
    expect(alert).toHaveTextContent(en.nova.error)
  })
})

describe('Ask Nova — panel accessibility', () => {
  it('is a labelled dialog; Escape closes it and focus returns to the launcher', async () => {
    await openPanel()
    expect(screen.getByRole('dialog', { name: en.nova.title })).toBeInTheDocument()
    expect(screen.getByRole('log', { name: en.nova.conversationLabel })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: en.nova.open })))
  })
})

describe('nextRevealLength', () => {
  it('reveals by whole words', () => {
    const full = 'Solar panels last long'
    const first = nextRevealLength(full, 0)
    expect(full.slice(0, first)).toBe('Solar')
    expect(full.slice(0, nextRevealLength(full, first))).toBe('Solar ')
  })

  it('finishes a 1,000-character answer within the capped duration (not 20 s)', () => {
    const full = 'solar '.repeat(170).trim() // ~1,000 chars, 170 words
    expect(full.length).toBeGreaterThan(990)
    let shown = 0
    let ticks = 0
    while (shown < full.length) {
      shown = nextRevealLength(full, shown)
      ticks += 1
      expect(ticks).toBeLessThan(500)
    }
    expect(ticks * REVEAL_TICK_MS).toBeLessThanOrEqual(REVEAL_MAX_MS)
  })
})
