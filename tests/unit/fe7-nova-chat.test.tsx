import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NovaChat } from '@/components/dashboard/nova/NovaChat'
import { NovaPanel } from '@/components/dashboard/nova/NovaPanel'
import { NovaShellProvider, useNovaPageContext, useNovaShell } from '@/lib/nova/page-context'
import { starterQuestions } from '@/lib/nova/logic'
import type { NovaContext } from '@/lib/nova/schemas'
import type { Role } from '@/lib/dashboard/types'
import {
  ARCHIVE_ANSWER, CONVERSATION_DETAIL, CONVERSATION_LIST, FEEDBACK_RESPONSE, NEEDS_CLARIFICATION, NOT_ON_RECORD, REFUSED,
} from './fixtures/nova-contract'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
  useUser: () => ({ user: { publicMetadata: { role: 'admin' } }, isLoaded: true }),
}))
vi.mock('@/lib/config', () => ({ API_BASE_URL: 'https://api.test' }))
vi.mock('next/navigation', async () => (await import('./helpers/mock-navigation')).navigationMock)

interface Call { method: string; path: string; body: unknown }
let calls: Call[]
let askQueue: Array<() => Response | Promise<Response>>
let conversations: unknown
let feedbackStatus = 200
let conversationsStatus = 200
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
const errBody = (code: string, message = 'x') => ({ detail: { code, message } })

beforeEach(() => {
  calls = []
  askQueue = []
  conversations = CONVERSATION_LIST
  feedbackStatus = 200
  conversationsStatus = 200
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url)
      const method = (init?.method ?? 'GET').toUpperCase()
      calls.push({ method, path: u.pathname, body: init?.body ? JSON.parse(init.body as string) : undefined })
      if (u.pathname.endsWith('/ask')) return (askQueue.shift() ?? (() => json(ARCHIVE_ANSWER)))()
      if (u.pathname.endsWith('/feedback')) return feedbackStatus === 200 ? json(FEEDBACK_RESPONSE) : json({}, feedbackStatus)
      if (u.pathname.endsWith('/conversations')) return conversationsStatus === 200 ? json(conversations) : json({}, conversationsStatus)
      if (u.pathname.includes('/conversations/')) return json(CONVERSATION_DETAIL)
      return json({}, 404)
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

function renderChat(props: Partial<React.ComponentProps<typeof NovaChat>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const user = userEvent.setup()
  const ui = <QueryClientProvider client={qc}><NovaChat variant="page" role="admin" context={null} {...props} /></QueryClientProvider>
  return { user, ...render(ui) }
}
const askCalls = () => calls.filter((c) => c.path.endsWith('/ask'))
const input = () => screen.getByLabelText('Your question for Nova') as HTMLTextAreaElement

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(input(), text)
  await user.click(screen.getByRole('button', { name: 'Send question' }))
}

describe('answer rendering', () => {
  it('shows the answer as plain text — markup stays text and line breaks are kept', async () => {
    const { user, container } = renderChat()
    await ask(user, 'Show projects in Howrah')
    const text = await screen.findByTestId('answer-text')
    expect(text.textContent).toContain('<b>bold</b> <script>alert(1)</script>')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(text.className).toContain('whitespace-pre-wrap')
    expect(text.textContent).toContain('\n')
  })

  it('cites records as chips: a link where a page opens the record, plain text where none does', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    await screen.findByTestId('nova-answer')
    const list = screen.getByRole('list', { name: 'Records cited' })
    const links = within(list).getAllByTestId('citation-link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/dashboard/archive/2', '/dashboard/archive/1'])
    const plain = within(list).getByTestId('citation-plain')
    expect(plain.textContent).toContain('C12')
    expect(plain.closest('a')).toBeNull()
    // the bracketed ref in the answer text is also a link; an uncited bracket is not
    const answer = screen.getByTestId('answer-text')
    expect(within(answer).getByRole('link', { name: '[GN-ARC-0102]' })).toHaveAttribute('href', '/dashboard/archive/2')
    expect(within(answer).queryByRole('link', { name: '[UNLISTED-1]' })).toBeNull()
  })

  it('renders tables as real tables with typed columns: money, kW, IST dates, booleans', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(within(rows[0]).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Reference', 'Capacity (kW)', 'Contract value', 'Commissioned', 'DCR', 'Units', 'Customer',
    ])
    const first = within(rows[1]).getAllByRole('cell').map((c) => c.textContent)
    expect(first).toEqual(['GN-ARC-0102', '10.000 kW', '₹12,34,567.50', '01 Jul 2025', 'Yes', '4', '=HYPERLINK("http://evil","x")'])
    const second = within(rows[2]).getAllByRole('cell').map((c) => c.textContent)
    expect(second.slice(2, 5)).toEqual(['-₹250.00', '—', 'No'])
    // the table scrolls inside its own box
    expect(table.closest('.overflow-auto')).not.toBeNull()
  })

  it('downloads the table as a formula-safe CSV', async () => {
    let blob: Blob | undefined
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:x'))
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { user } = renderChat()
    await ask(user, 'q')
    await user.click(await screen.findByRole('button', { name: /Download CSV/ }))
    expect(click).toHaveBeenCalled()
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.readAsText(blob as Blob)
    })
    expect(text).toContain('"\'=HYPERLINK(""http://evil"",""x"")"')
    expect(text).toContain("'@SUM(A1)")
    expect(text).toContain(',-250.00,')
    click.mockRestore()
  })

  it('has a collapsible "What I searched" built from searched[]', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    const details = await screen.findByTestId('searched')
    expect(details.tagName).toBe('DETAILS')
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByText('What I searched')).toBeInTheDocument()
    expect(within(details).getByText('district Howrah, at least 5 kW')).toBeInTheDocument()
    expect(within(details).getByText('capacity min kw')).toBeInTheDocument()
  })

  it('suggestion chips re-ask in the same conversation; a path-only suggestion is a link', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    const chips = await screen.findByRole('list', { name: 'Suggestions' })
    expect(within(chips).getByRole('link', { name: 'Open the first result' })).toHaveAttribute('href', '/dashboard/archive/2')
    await user.click(within(chips).getByRole('button', { name: 'Totals by district' }))
    await waitFor(() => expect(askCalls()).toHaveLength(2))
    expect(askCalls()[1].body).toEqual({ question: 'How many of these projects are there by district?', conversation_id: ARCHIVE_ANSWER.conversation_id })
  })
})

describe('statuses', () => {
  it('answered has no status badge', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    expect(await screen.findByTestId('nova-answer')).toHaveAttribute('data-status', 'answered')
    expect(screen.queryByTestId('status-badge')).toBeNull()
  })

  it('not_on_record is neutral and shows the searched filters open', async () => {
    askQueue.push(() => json(NOT_ON_RECORD))
    const { user } = renderChat()
    await ask(user, 'q')
    const card = await screen.findByTestId('nova-answer')
    expect(card).toHaveAttribute('data-status', 'not_on_record')
    expect(card.className).toContain('bg-[#f7f9fc]')
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Not on record')
    expect(screen.getByTestId('searched')).toHaveAttribute('open')
    expect(within(screen.getByTestId('searched')).getByText('Atlantis')).toBeInTheDocument()
  })

  it('needs_clarification shows the question and the reply continues the conversation', async () => {
    askQueue.push(() => json(NEEDS_CLARIFICATION))
    const { user } = renderChat()
    await ask(user, 'Das')
    const card = await screen.findByTestId('nova-answer')
    expect(card).toHaveAttribute('data-status', 'needs_clarification')
    expect(card).toHaveTextContent('Which one do you mean?')
    expect(card).toHaveTextContent('Reply below')
    await ask(user, 'Bikash')
    await waitFor(() => expect(askCalls()).toHaveLength(2))
    expect(askCalls()[1].body).toMatchObject({ question: 'Bikash', conversation_id: NEEDS_CLARIFICATION.conversation_id })
  })

  it('refused is neutral', async () => {
    askQueue.push(() => json(REFUSED))
    const { user } = renderChat()
    await ask(user, 'delete lead 3')
    const card = await screen.findByTestId('nova-answer')
    expect(card).toHaveAttribute('data-status', 'refused')
    expect(card.className).toContain('bg-[#f7f9fc]')
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Nova can’t do that')
    expect(card).toHaveTextContent('I can only read records')
  })
})

describe('feedback', () => {
  it('thumbs + optional note go to the feedback endpoint, once per turn', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    await screen.findByTestId('nova-answer')
    await user.click(screen.getByRole('button', { name: 'Helpful' }))
    await user.type(screen.getByLabelText('Add a note (optional)'), 'Thanks')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))
    await screen.findByTestId('feedback-sent')
    const fb = calls.find((c) => c.path.endsWith('/feedback'))!
    expect(fb.path).toBe(`/api/v1/dashboard/nova/turns/${ARCHIVE_ANSWER.turn_id}/feedback`)
    expect(fb.body).toEqual({ helpful: true, note: 'Thanks' })
    expect(screen.getByTestId('feedback-sent')).toHaveTextContent('You marked this helpful.')
    expect(screen.queryByRole('button', { name: 'Helpful' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send feedback' })).toBeNull()
  })

  it('a thumbs-down without a note sends no note key', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    await screen.findByTestId('nova-answer')
    await user.click(screen.getByRole('button', { name: 'Not helpful' }))
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))
    await screen.findByTestId('feedback-sent')
    expect(calls.find((c) => c.path.endsWith('/feedback'))!.body).toEqual({ helpful: false })
  })

  it('feedback already given on an earlier turn is shown, not offered again', async () => {
    const { user } = renderChat()
    await user.click(await screen.findByRole('button', { name: /Which warranties end next month/ }))
    expect(await screen.findByTestId('feedback-sent')).toHaveTextContent('Spot on')
    expect(screen.queryByRole('button', { name: 'Helpful' })).toBeNull()
  })

  it('a failed feedback call says so and leaves the buttons', async () => {
    feedbackStatus = 500
    const { user } = renderChat()
    await ask(user, 'q')
    await screen.findByTestId('nova-answer')
    await user.click(screen.getByRole('button', { name: 'Helpful' }))
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(await screen.findByText(/could not answer just now/)).toBeInTheDocument()
    expect(screen.queryByTestId('feedback-sent')).toBeNull()
  })
})

describe('input', () => {
  it('Enter sends, Shift+Enter makes a new line, the counter counts', async () => {
    const { user } = renderChat()
    await user.type(input(), 'line one{Shift>}{Enter}{/Shift}line two')
    expect(input().value).toBe('line one\nline two')
    expect(screen.getByTestId('nova-count')).toHaveTextContent('17/1000')
    expect(askCalls()).toHaveLength(0)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(askCalls()).toHaveLength(1))
    expect(askCalls()[0].body).toEqual({ question: 'line one\nline two' })
  })

  it('does not send blank text or more than 1000 characters', async () => {
    const { user } = renderChat()
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled()
    await user.type(input(), '   ')
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled()
    await user.clear(input())
    await user.click(input())
    await user.paste('x'.repeat(1001))
    expect(screen.getByTestId('nova-count')).toHaveTextContent('1001/1000 — too long')
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(askCalls()).toHaveLength(0)
  })

  it('the box is at least 16px on phones and the controls are 44px', () => {
    renderChat()
    expect(input().className).toContain('text-base')
    expect(screen.getByRole('button', { name: 'Send question' }).className).toContain('min-h-[44px]')
  })
})

describe('states', () => {
  it('shows a typing indicator and disables sending while Nova works, then returns focus to the box', async () => {
    let release!: () => void
    askQueue.push(() => new Promise<Response>((res) => (release = () => res(json(ARCHIVE_ANSWER)))))
    const { user } = renderChat()
    await ask(user, 'q')
    expect(await screen.findByTestId('nova-typing')).toHaveTextContent('Nova is checking the records')
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled()
    expect(input()).toBeDisabled()
    release()
    await screen.findByTestId('nova-answer')
    expect(screen.queryByTestId('nova-typing')).toBeNull()
    await waitFor(() => expect(input()).toHaveFocus())
  })

  it('a 429 rate limit says when to try again and keeps the question for a retry', async () => {
    askQueue.push(() => json(errBody('rate_limited'), 429, { 'Retry-After': '60' }))
    const { user } = renderChat()
    await ask(user, 'my question')
    const alert = await screen.findByTestId('nova-error')
    expect(alert).toHaveAttribute('data-kind', 'rate_limited')
    expect(alert).toHaveTextContent('Try again in 60 seconds')
    expect(input().value).toBe('my question')
    expect(screen.queryByTestId('nova-typing')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    await screen.findByTestId('nova-answer')
    expect(askCalls().map((c) => (c.body as { question: string }).question)).toEqual(['my question', 'my question'])
    expect(screen.queryByTestId('nova-error')).toBeNull()
  })

  it('the daily limit has no retry button', async () => {
    askQueue.push(() => json(errBody('daily_limit_reached'), 429))
    const { user } = renderChat()
    await ask(user, 'q')
    const alert = await screen.findByTestId('nova-error')
    expect(alert).toHaveTextContent('today’s question limit')
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('a network error offers a retry', async () => {
    askQueue.push(() => Promise.reject(new TypeError('Failed to fetch')))
    const { user } = renderChat()
    await ask(user, 'q')
    const alert = await screen.findByTestId('nova-error')
    expect(alert).toHaveAttribute('data-kind', 'network')
    expect(alert).toHaveTextContent('Can’t reach the server')
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    await screen.findByTestId('nova-answer')
  })

  it('assistant_disabled and records_unavailable are told apart', async () => {
    askQueue.push(() => json(errBody('assistant_disabled'), 503), () => json(errBody('records_unavailable'), 503))
    const { user } = renderChat()
    await ask(user, 'q')
    expect(await screen.findByTestId('nova-error')).toHaveTextContent('switched off')
    expect(within(screen.getByTestId('nova-error')).queryByRole('button', { name: 'Retry' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() => expect(screen.getByTestId('nova-error')).toHaveTextContent('could not answer just now'))
  })

  it('a conversation that no longer exists starts fresh on the next question', async () => {
    const { user } = renderChat()
    await ask(user, 'first')
    await screen.findByTestId('nova-answer')
    askQueue.push(() => json(errBody('conversation_not_found'), 404))
    await ask(user, 'second')
    expect(await screen.findByTestId('nova-error')).toHaveTextContent('no longer available')
    await user.click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() => expect(askCalls()).toHaveLength(3))
    expect(askCalls()[2].body).toEqual({ question: 'second' })
  })

  it('an answer that breaks the contract is a retryable error, not a crash', async () => {
    askQueue.push(() => json({ ...ARCHIVE_ANSWER, status: 'maybe' }))
    const { user } = renderChat()
    await ask(user, 'q')
    expect(await screen.findByTestId('nova-error')).toHaveTextContent('could not read')
  })

  it('shows an empty history and the empty-conversation prompt', async () => {
    conversations = { items: [] }
    renderChat()
    expect(await screen.findByTestId('history-empty')).toHaveTextContent('No conversations yet')
    expect(screen.getByTestId('nova-empty')).toBeInTheDocument()
  })

  it('a history that fails to load can be retried', async () => {
    conversationsStatus = 500
    renderChat()
    const retry = await screen.findByRole('button', { name: 'Retry' })
    conversationsStatus = 200
    await userEvent.click(retry)
    expect(await screen.findByText(CONVERSATION_LIST.items[0].title)).toBeInTheDocument()
  })
})

describe('history', () => {
  it('lists own conversations, opens one with its turns, and a new conversation clears it', async () => {
    const { user } = renderChat()
    const item = await screen.findByRole('button', { name: /Which warranties end next month/ })
    await user.click(item)
    expect(await screen.findByTestId('nova-question')).toHaveTextContent('Which warranties end next month?')
    expect(screen.getByTestId('nova-answer')).toHaveTextContent('One warranty ends next month.')
    await ask(user, 'and in Nadia?')
    await waitFor(() => expect(askCalls()).toHaveLength(1))
    expect(askCalls()[0].body).toMatchObject({ conversation_id: CONVERSATION_DETAIL.conversation_id })
    await user.click(screen.getByRole('button', { name: 'New conversation' }))
    expect(screen.queryByTestId('nova-answer')).toBeNull()
    expect(screen.getByTestId('nova-empty')).toBeInTheDocument()
    await ask(user, 'fresh')
    await waitFor(() => expect(askCalls()).toHaveLength(2))
    expect(askCalls()[1].body).toEqual({ question: 'fresh' })
  })
})

describe('starter questions', () => {
  it.each(['admin', 'accounts', 'operations', 'engineer', 'sales', 'management'] as Role[])('%s sees their own questions, and clicking one asks it', async (role) => {
    const { user } = renderChat({ role })
    const list = screen.getByRole('list', { name: 'Starter questions' })
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(starterQuestions(role))
    await user.click(within(list).getAllByRole('button')[0])
    await waitFor(() => expect(askCalls()).toHaveLength(1))
    expect((askCalls()[0].body as { question: string }).question).toBe(starterQuestions(role)[0])
  })
})

describe('context from the page', () => {
  const lead: NovaContext = { lead_id: 45, customer_id: 12 }
  it('is sent with the question and the user is told what "this" means', async () => {
    const { user } = renderChat({ variant: 'panel', context: lead })
    expect(screen.getByTestId('nova-context')).toHaveTextContent('lead #45')
    await ask(user, 'What is the status of this lead?')
    await waitFor(() => expect(askCalls()).toHaveLength(1))
    expect(askCalls()[0].body).toEqual({ question: 'What is the status of this lead?', context: lead })
  })

  it('a project page sends project_ref', async () => {
    const { user } = renderChat({ variant: 'panel', context: { project_ref: 'GNE-WB-RES-2026-00125' } })
    await ask(user, 'when does the warranty end on this project?')
    await waitFor(() => expect(askCalls()).toHaveLength(1))
    expect((askCalls()[0].body as { context: unknown }).context).toEqual({ project_ref: 'GNE-WB-RES-2026-00125' })
  })

  it('sends no context key on a page that has none', async () => {
    const { user } = renderChat({ context: null })
    expect(screen.queryByTestId('nova-context')).toBeNull()
    await ask(user, 'q')
    await waitFor(() => expect(askCalls()).toHaveLength(1))
    expect(askCalls()[0].body).not.toHaveProperty('context')
  })

  it('a question handed over from the command palette lands in the box without being sent', () => {
    renderChat({ variant: 'panel', draft: 'warranty ending soon' })
    expect(input().value).toBe('warranty ending soon')
    expect(askCalls()).toHaveLength(0)
  })
})

describe('accessibility', () => {
  it('new answers are announced politely and the log is labelled', async () => {
    const { user } = renderChat()
    const log = screen.getByRole('log', { name: 'Conversation with Nova Records' })
    expect(log).toHaveAttribute('aria-live', 'polite')
    await ask(user, 'q')
    await screen.findByTestId('nova-answer')
    expect(within(log).getByTestId('nova-answer')).toBeInTheDocument()
  })

  it('chips are real buttons/links, reachable by keyboard', async () => {
    const { user } = renderChat()
    await ask(user, 'q')
    const chip = await screen.findByRole('button', { name: 'Totals by district' })
    chip.focus()
    expect(chip).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(askCalls()).toHaveLength(2))
  })
})

function Registrar({ ctx }: { ctx: NovaContext | null }) {
  useNovaPageContext(ctx)
  const { openPanel } = useNovaShell()
  return <button onClick={() => openPanel()}>open</button>
}

describe('the Ask Nova panel', () => {
  function renderPanel(ctx: NovaContext | null) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const user = userEvent.setup()
    const tree = (c: NovaContext | null) => (
      <QueryClientProvider client={qc}>
        <NovaShellProvider>
          <Registrar ctx={c} />
          <NovaPanel />
        </NovaShellProvider>
      </QueryClientProvider>
    )
    return { user, ...render(tree(ctx)), tree }
  }

  it('is not mounted until opened, then carries the page context', async () => {
    const { user } = renderPanel({ project_ref: 'GNE-WB-RES-2026-00125' })
    expect(screen.queryByTestId('nova-panel')).toBeNull()
    expect(calls).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'open' }))
    const panel = await screen.findByTestId('nova-panel')
    expect(within(panel).getByTestId('nova-context')).toHaveTextContent('project GNE-WB-RES-2026-00125')
    await user.type(within(panel).getByLabelText('Your question for Nova'), 'When does the warranty end on this project?')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(askCalls()).toHaveLength(1))
    expect(askCalls()[0].body).toMatchObject({ context: { project_ref: 'GNE-WB-RES-2026-00125' } })
  })

  it('the context goes away with the page that registered it', async () => {
    const { user, rerender, tree } = renderPanel({ lead_id: 45 })
    rerender(tree(null))
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(within(await screen.findByTestId('nova-panel')).queryByTestId('nova-context')).toBeNull()
  })

  it('closes with its button, and following a citation closes it', async () => {
    const { user } = renderPanel(null)
    await user.click(screen.getByRole('button', { name: 'open' }))
    const panel = await screen.findByTestId('nova-panel')
    await user.type(within(panel).getByLabelText('Your question for Nova'), 'q{Enter}')
    const link = await within(panel).findAllByTestId('citation-link')
    link[0].addEventListener('click', (e) => e.preventDefault())
    await user.click(link[0])
    await waitFor(() => expect(screen.queryByTestId('nova-panel')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'open' }))
    await user.click(await screen.findByRole('button', { name: 'Close Ask Nova' }))
    await waitFor(() => expect(screen.queryByTestId('nova-panel')).toBeNull())
  })
})
