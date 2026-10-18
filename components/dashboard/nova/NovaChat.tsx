'use client'

import { useEffect, useRef, useState } from 'react'
import { History, Loader2, MessageSquarePlus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NovaAnswer, type AnsweredTurn } from '@/components/dashboard/nova/NovaAnswer'
import { useLoadNovaConversation, useNovaAsk, useNovaConversations, useNovaFeedback } from '@/lib/nova/api-client'
import { NOVA_QUESTION_MAX, describeAskError, describeContext, isEmptyContext, starterQuestions, type AskFailure } from '@/lib/nova/logic'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { Role } from '@/lib/dashboard/types'
import type { AskResponse, NovaContext, NovaTurn } from '@/lib/nova/schemas'

type ChatItem = { id: string; question: string; turn: AnsweredTurn | null }

function fromAsk(r: AskResponse): AnsweredTurn {
  return {
    turnId: r.turn_id,
    status: r.status,
    answer: r.answer,
    citations: r.citations,
    tables: r.tables,
    searched: r.searched,
    suggestions: r.suggestions,
    generatedAt: r.generated_at,
    feedback: null,
  }
}

function fromHistory(t: NovaTurn): ChatItem {
  return {
    id: t.turn_id,
    question: t.question,
    turn: {
      turnId: t.turn_id,
      status: t.status,
      answer: t.answer,
      citations: t.citations,
      tables: t.tables,
      searched: t.searched,
      suggestions: t.suggestions,
      generatedAt: t.generated_at,
      feedback: typeof t.feedback.helpful === 'boolean' ? { helpful: t.feedback.helpful, note: t.feedback.note ?? null } : null,
    },
  }
}

/**
 * The Nova Records conversation. `page` shows the history list beside the chat;
 * `panel` (the slide-over) puts it behind a button. `context` is the record of the page the
 * panel was opened from — it rides along with every question so "this project" works.
 */
export function NovaChat({
  variant,
  role,
  context,
  draft = '',
}: {
  variant: 'page' | 'panel'
  role: Role | undefined
  context: NovaContext | null
  draft?: string
}) {
  const ask = useNovaAsk()
  const feedback = useNovaFeedback()
  const loadConversation = useLoadNovaConversation()
  const [historyOpen, setHistoryOpen] = useState(variant === 'page')
  const history = useNovaConversations(historyOpen)

  const [items, setItems] = useState<ChatItem[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [text, setText] = useState(draft)
  const [seenDraft, setSeenDraft] = useState(draft)
  const [failure, setFailure] = useState<{ failure: AskFailure; question: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState<{ turnId: string; message: string } | null>(null)
  const pending = ask.isPending

  // A question handed over from the command palette lands in the box (adjusting state while rendering).
  if (draft !== seenDraft) {
    setSeenDraft(draft)
    if (draft) setText(draft)
  }

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const wasPending = useRef(false)
  const nextPendingId = useRef(0)

  // Focus goes back to the box once an answer (or an error) has arrived.
  useEffect(() => {
    if (wasPending.current && !pending) inputRef.current?.focus()
    wasPending.current = pending
  }, [pending])
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [items.length, pending])

  const trimmed = text.trim()
  const tooLong = text.length > NOVA_QUESTION_MAX
  const canSend = !pending && trimmed.length > 0 && !tooLong

  async function send(question: string) {
    const q = question.trim()
    if (!q || q.length > NOVA_QUESTION_MAX || pending) return
    nextPendingId.current += 1
    const id = `pending-${nextPendingId.current}`
    setFailure(null)
    setText('')
    setItems((prev) => [...prev, { id, question: q, turn: null }])
    try {
      const res = await ask.mutateAsync({
        question: q,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        ...(isEmptyContext(context) ? {} : { context: context as NovaContext }),
      })
      setConversationId(res.conversation_id)
      setItems((prev) => prev.map((it) => (it.id === id ? { id: res.turn_id, question: q, turn: fromAsk(res) } : it)))
    } catch (err) {
      const f = describeAskError(err)
      setItems((prev) => prev.filter((it) => it.id !== id))
      // The question goes back in the box so nothing typed is lost.
      setText(q)
      if (f.kind === 'conversation_gone') setConversationId(null)
      setFailure({ failure: f, question: q })
    }
  }

  function newConversation() {
    setItems([])
    setConversationId(null)
    setFailure(null)
    setLoadError(null)
    setText('')
    inputRef.current?.focus()
  }

  async function openConversation(id: string) {
    setLoadError(null)
    setFailure(null)
    setLoadingId(id)
    try {
      const detail = await loadConversation(id)
      setItems(detail.turns.map(fromHistory))
      setConversationId(detail.conversation_id)
      if (variant === 'panel') setHistoryOpen(false)
    } catch (err) {
      setLoadError(describeAskError(err).message)
    } finally {
      setLoadingId(null)
    }
  }

  async function sendFeedback(turnId: string, helpful: boolean, note: string) {
    setFeedbackError(null)
    try {
      const res = await feedback.mutateAsync({ turnId, helpful, ...(note ? { note } : {}) })
      setItems((prev) =>
        prev.map((it) => (it.turn?.turnId === turnId ? { ...it, turn: { ...it.turn, feedback: { helpful: res.helpful, note: res.note ?? null } } } : it)),
      )
    } catch (err) {
      setFeedbackError({ turnId, message: describeAskError(err).message })
    }
  }

  const contextLine = describeContext(context)
  const starters = starterQuestions(role)
  const conversations = history.data ?? []

  const historyList = (
    <section aria-label="Your conversations" className="space-y-2">
      <Button type="button" variant="outline" className="min-h-[44px] w-full justify-start" onClick={newConversation}>
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        New conversation
      </Button>
      {history.isLoading ? (
        <p className="text-sm text-gray-500" role="status">Loading your conversations…</p>
      ) : history.error ? (
        <div className="space-y-2 text-sm text-red-600" role="alert">
          <p>Couldn’t load your conversations.</p>
          <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => void history.refetch()}>Retry</Button>
        </div>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="history-empty">No conversations yet. Ask your first question.</p>
      ) : (
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li key={c.conversation_id}>
              <button
                type="button"
                onClick={() => void openConversation(c.conversation_id)}
                aria-current={c.conversation_id === conversationId ? 'true' : undefined}
                disabled={loadingId !== null}
                className={`min-h-[44px] w-full rounded-lg border px-3 py-2 text-left text-sm font-utility focus-visible:outline-2 focus-visible:outline-[#f7a800] ${
                  c.conversation_id === conversationId ? 'border-[#0e2a63] bg-[#f7f9fc]' : 'border-[#e4e8ee] bg-white hover:bg-[#f7f9fc]'
                }`}
              >
                <span className="line-clamp-2 break-words font-medium text-[#091c3c]">{c.title}</span>
                <span className="block text-xs text-gray-500">
                  {c.turn_count} {c.turn_count === 1 ? 'question' : 'questions'} · {formatDatetime(c.updated_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {loadError && (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      )}
    </section>
  )

  return (
    <div className={variant === 'page' ? 'grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]' : 'flex h-full min-h-0 flex-col gap-3'}>
      {variant === 'page' && <aside>{historyList}</aside>}

      <div className={variant === 'page' ? 'flex min-w-0 flex-col gap-3' : 'flex min-h-0 flex-1 flex-col gap-3'}>
        {variant === 'panel' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" aria-expanded={historyOpen} onClick={() => setHistoryOpen((v) => !v)}>
              <History className="h-4 w-4" aria-hidden="true" />
              History
            </Button>
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={newConversation}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              New
            </Button>
          </div>
        )}
        {variant === 'panel' && historyOpen && <div className="max-h-60 overflow-auto rounded-lg border border-[#e4e8ee] p-2">{historyList}</div>}

        {contextLine && (
          <p className="rounded-lg bg-[#f7f9fc] px-3 py-2 text-xs text-gray-700" data-testid="nova-context">
            Asking about <span className="font-semibold">{contextLine}</span>. “This project” means this record.
          </p>
        )}

        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation with Nova Records"
          className={`space-y-4 overflow-y-auto ${variant === 'panel' ? 'min-h-0 flex-1' : 'min-h-[40vh] md:max-h-[60vh]'}`}
        >
          {items.length === 0 && !pending && (
            <div className="space-y-3 py-2" data-testid="nova-empty">
              <p className="text-sm text-gray-700">
                Ask about projects, leads, payments, warranties and service requests. Nova answers only from the records your role can see, and shows where each answer came from.
              </p>
              {starters.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Starter questions">
                  {starters.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => void send(q)}
                        className="min-h-[44px] rounded-full border border-[#e4e8ee] bg-white px-3 py-1 text-left text-xs font-utility text-[#091c3c] hover:bg-[#f7f9fc] focus-visible:outline-2 focus-visible:outline-[#f7a800]"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {items.map((it) => (
            <div key={it.id} className="space-y-2">
              <p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-xl bg-[#091c3c] px-3 py-2 text-sm text-white" data-testid="nova-question">
                {it.question}
              </p>
              {it.turn ? (
                <NovaAnswer
                  turn={it.turn}
                  onAsk={(q) => void send(q)}
                  onFeedback={(id, h, n) => void sendFeedback(id, h, n)}
                  feedbackBusy={feedback.isPending}
                  feedbackError={feedbackError?.turnId === it.turn.turnId ? feedbackError.message : null}
                  disabled={pending}
                />
              ) : (
                <p className="flex items-center gap-2 text-sm text-gray-600" role="status" data-testid="nova-typing">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Nova is checking the records…
                </p>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {failure && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="nova-error" data-kind={failure.failure.kind}>
            <p className="min-w-0 flex-1 break-words">{failure.failure.message}</p>
            {failure.failure.retryable && (
              <Button type="button" variant="outline" size="sm" className="min-h-[44px]" disabled={pending} onClick={() => void send(failure.question)}>
                Retry
              </Button>
            )}
          </div>
        )}

        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSend) void send(text)
          }}
        >
          <label htmlFor={`nova-input-${variant}`} className="sr-only">
            Your question for Nova
          </label>
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              id={`nova-input-${variant}`}
              rows={2}
              value={text}
              maxLength={NOVA_QUESTION_MAX + 200}
              disabled={pending}
              placeholder="Ask about a project, lead, payment or warranty…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter is a new line. Never send mid-composition (Hindi / Bengali IME).
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  if (canSend) void send(text)
                }
              }}
              aria-describedby={`nova-count-${variant}`}
              className="min-h-[64px] flex-1 resize-none"
            />
            <Button type="submit" disabled={!canSend} className="min-h-[44px] min-w-[44px]" aria-label="Send question">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <p id={`nova-count-${variant}`} className={`text-right text-xs ${tooLong ? 'text-red-600' : 'text-gray-500'}`} data-testid="nova-count">
            {text.length}/{NOVA_QUESTION_MAX}
            {tooLong ? ' — too long' : ''}
          </p>
        </form>
      </div>
    </div>
  )
}
