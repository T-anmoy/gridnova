'use client'

import { useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAskMemory } from '@/lib/dashboard/staff-leads-api-client'
import { ASK_MAX, askOutcome, mapMemoryError, validQuestion, type MappedError, type MemoryErrorKey } from '@/lib/dashboard/staff-leads-logic'
import { fmt, type StaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { MemoryAskRequest, MemoryAskResponse } from '@/lib/dashboard/staff-leads-types'

const TEXT = 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'

/**
 * Ask-memory (POST /memory/ask). On a lead page pass `customerId`; the answer
 * is English prose from the server and is shown as plain text, untranslated.
 */
export function AskMemoryPanel({ customerId, copy }: { customerId?: number; copy: StaffLeadsCopy }) {
  const c = copy.ask
  const [question, setQuestion] = useState('')
  const [lastRequest, setLastRequest] = useState<MemoryAskRequest | null>(null)
  const [response, setResponse] = useState<MemoryAskResponse | null>(null)
  const [error, setError] = useState<MappedError<MemoryErrorKey> | null>(null)
  const mutation = useAskMemory()

  async function send(req: MemoryAskRequest) {
    setLastRequest(req)
    setError(null)
    try {
      setResponse(await mutation.mutateAsync(req))
    } catch (err) {
      setResponse(null)
      setError(mapMemoryError(err))
    }
  }

  function ask() {
    if (!validQuestion(question) || mutation.isPending) return
    void send({ question: question.trim(), ...(customerId != null ? { customer_id: customerId } : {}) })
  }

  const outcome = response ? askOutcome(response) : null
  const retryable = error && (error.key === 'agent' || error.key === 'network' || error.key === 'generic')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" /> {c.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-utility text-xs text-[#111827]/65">{customerId != null ? c.description : c.descriptionAny}</p>
        <form onSubmit={(e) => { e.preventDefault(); ask() }} className="space-y-2">
          <Label htmlFor="ask-memory-question">{c.questionLabel}</Label>
          <textarea
            id="ask-memory-question"
            rows={3}
            maxLength={ASK_MAX}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-describedby="ask-memory-counter"
            className="w-full rounded-lg border border-[#e4e8ee] bg-white px-3 py-2 text-base md:text-sm font-utility text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span id="ask-memory-counter" className="font-utility text-xs text-[#111827]/65">
              {fmt(c.counter, { count: question.length })}
            </span>
            <Button type="submit" className="min-h-11" disabled={!validQuestion(question) || mutation.isPending}>
              {mutation.isPending ? c.asking : c.submit}
            </Button>
          </div>
        </form>

        <div aria-live="polite" role="status" className="space-y-3">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="font-utility text-sm text-red-800">{c.errors[error.key]}</p>
              {error.serverText && <p className={`mt-1 font-utility text-xs text-red-800 ${TEXT}`}>{error.serverText}</p>}
              {retryable && lastRequest && (
                <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={mutation.isPending} onClick={() => void send(lastRequest)}>
                  {copy.common.retry}
                </Button>
              )}
            </div>
          )}

          {response && outcome === 'answered' && (
            <div className="space-y-2">
              <h3 className="font-utility text-sm font-semibold text-[#091c3c]">{c.answerTitle}</h3>
              {/* English prose from the server: shown as-is, as plain text. */}
              <p lang="en" className={`font-utility text-sm text-[#111827] ${TEXT}`}>{response.answer}</p>
              {response.retrieval_mode && (
                <p className="font-utility text-xs text-[#111827]/65">{fmt(c.retrieval, { mode: response.retrieval_mode })}</p>
              )}
              <h4 className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/65">{c.citationsTitle}</h4>
              {response.citations.length === 0 ? (
                <p className="font-utility text-xs text-[#111827]/65">{c.noCitations}</p>
              ) : (
                <ul className="space-y-1.5">
                  {response.citations.map((cit) => (
                    <li key={cit.id} className="rounded-lg border border-[#e4e8ee] p-2 font-utility text-xs text-[#111827]">
                      <span className="font-semibold">{(copy.memory.kinds as Record<string, string>)[cit.kind] ?? cit.kind}</span>
                      {' · '}{formatDatetime(cit.occurred_at)} IST
                      <span className={`mt-0.5 block ${TEXT}`}>{cit.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {response && outcome === 'ambiguous' && (
            <div className="space-y-2">
              <h3 className="font-utility text-sm font-semibold text-[#091c3c]">{c.pickTitle}</h3>
              <p className="font-utility text-xs text-[#111827]/65">{c.pickHelp}</p>
              <ul className="space-y-2">
                {response.candidates.map((cand) => (
                  <li key={cand.customer_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4e8ee] p-3">
                    <div className={`min-w-0 font-utility text-sm text-[#111827] ${TEXT}`}>
                      <span className="font-semibold">{cand.name}</span>
                      <span className="block text-xs text-[#111827]/65">{cand.email}</span>
                      {cand.company && <span className="block text-xs text-[#111827]/65">{cand.company}</span>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={mutation.isPending || !lastRequest}
                      onClick={() => lastRequest && void send({ question: lastRequest.question, customer_id: cand.customer_id })}
                    >
                      {c.pick}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {response && outcome === 'unresolved' && (
            <p className="font-utility text-sm text-[#111827]/75">{c.noMatch}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
