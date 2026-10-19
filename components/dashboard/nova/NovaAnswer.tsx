'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { csvFilename, downloadCsv, formatCell, safeDashboardPath, splitAnswer, tableToCsv } from '@/lib/nova/logic'
import type { AskStatus, Citation, NovaTable, Searched, Suggestion } from '@/lib/nova/schemas'

export interface DisplayFeedback {
  helpful: boolean
  note: string | null
}

/** One answered turn as the screen holds it — whether it came from /ask or from history. */
export interface AnsweredTurn {
  turnId: string
  status: AskStatus
  answer: string
  citations: Citation[]
  tables: NovaTable[]
  searched: Searched[]
  suggestions: Suggestion[]
  generatedAt: string
  feedback: DisplayFeedback | null
}

const STATUS_LABEL: Record<AskStatus, string | null> = {
  answered: null,
  not_on_record: 'Not on record',
  needs_clarification: 'Nova needs a little more',
  refused: 'Nova can’t do that',
}

const chipClass =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#e4e8ee] bg-white px-3 py-1 text-xs font-utility text-[#091c3c] focus-visible:outline-2 focus-visible:outline-[#f7a800]'

function CitationChip({ citation }: { citation: Citation }) {
  const href = safeDashboardPath(citation.path)
  const body = (
    <>
      <span className="font-semibold">{citation.ref}</span>
      <span className="text-gray-600">{citation.label}</span>
    </>
  )
  // No page opens this record (or the role cannot open it): the chip is shown without a link.
  return href ? (
    <Link href={href} className={`${chipClass} hover:bg-[#f7f9fc]`} data-testid="citation-link">
      {body}
    </Link>
  ) : (
    <span className={chipClass} data-testid="citation-plain">
      {body}
    </span>
  )
}

/** Plain text only: React escapes everything, line breaks come from CSS, refs become inline chips. */
function AnswerText({ answer, citations }: { answer: string; citations: Citation[] }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900" data-testid="answer-text">
      {splitAnswer(answer, citations).map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.text}</span>
        const href = safeDashboardPath(seg.citation.path)
        return href ? (
          <Link key={i} href={href} className="font-semibold text-[#0e2a63] underline">
            {seg.text}
          </Link>
        ) : (
          <span key={i} className="font-semibold">
            {seg.text}
          </span>
        )
      })}
    </p>
  )
}

function ResultTable({ table }: { table: NovaTable }) {
  if (table.columns.length === 0) return null
  return (
    <section aria-label={table.title} className="rounded-lg border border-[#e4e8ee] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e8ee] px-3 py-2">
        <h4 className="text-sm font-semibold text-[#091c3c]">
          {table.title} <span className="font-normal text-gray-500">({table.rows.length})</span>
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={() => downloadCsv(csvFilename(table.title), tableToCsv(table))}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download CSV
        </Button>
      </div>
      {/* The table scrolls inside its own box, never the page. */}
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {table.columns.map((c) => (
                <TableHead key={c.key} scope="col" className={`whitespace-nowrap ${c.type === 'money' || c.type === 'kw' || c.type === 'number' ? 'text-right' : ''}`}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, i) => (
              <TableRow key={i}>
                {table.columns.map((c) => (
                  <TableCell key={c.key} className={`whitespace-nowrap ${c.type === 'money' || c.type === 'kw' || c.type === 'number' ? 'text-right tabular-nums' : ''}`}>
                    {formatCell(row[c.key], c.type)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function SearchedList({ searched, defaultOpen }: { searched: Searched[]; defaultOpen: boolean }) {
  if (searched.length === 0) return null
  return (
    <details className="rounded-lg border border-[#e4e8ee] bg-white text-sm" open={defaultOpen} data-testid="searched">
      <summary className="flex min-h-[44px] cursor-pointer items-center px-3 font-medium text-[#091c3c]">What I searched</summary>
      <ul className="space-y-2 border-t border-[#e4e8ee] px-3 py-2">
        {searched.map((s, i) => (
          <li key={i}>
            <p className="text-gray-900">{s.summary}</p>
            {Object.keys(s.filters).length > 0 && (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-gray-600">
                {Object.entries(s.filters).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-medium">{k.replace(/_/g, ' ')}</dt>
                    <dd className="break-words">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

function FeedbackRow({
  feedback,
  busy,
  error,
  onSubmit,
}: {
  feedback: DisplayFeedback | null
  busy: boolean
  error: string | null
  onSubmit: (helpful: boolean, note: string) => void
}) {
  const [choice, setChoice] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  // One feedback per turn: once sent it is shown, not editable.
  if (feedback) {
    return (
      <p className="text-xs text-gray-600" data-testid="feedback-sent">
        {feedback.helpful ? 'You marked this helpful.' : 'You marked this not helpful.'}
        {feedback.note ? ` Note: ${feedback.note}` : ''}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600" id="fb-label">Was this helpful?</span>
        <Button type="button" variant={choice === true ? 'navy' : 'outline'} size="icon" className="h-11 w-11" aria-pressed={choice === true} aria-label="Helpful" onClick={() => setChoice(true)}>
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant={choice === false ? 'navy' : 'outline'} size="icon" className="h-11 w-11" aria-pressed={choice === false} aria-label="Not helpful" onClick={() => setChoice(false)}>
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {choice !== null && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700" htmlFor="fb-note">
            Add a note (optional)
          </label>
          <Textarea id="fb-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[64px]" />
          <Button type="button" size="sm" className="min-h-[44px]" disabled={busy} onClick={() => onSubmit(choice, note.trim())}>
            Send feedback
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export function NovaAnswer({
  turn,
  onAsk,
  onFeedback,
  feedbackBusy,
  feedbackError,
  disabled,
}: {
  turn: AnsweredTurn
  onAsk: (question: string) => void
  onFeedback: (turnId: string, helpful: boolean, note: string) => void
  feedbackBusy: boolean
  feedbackError: string | null
  disabled: boolean
}) {
  const label = STATUS_LABEL[turn.status]
  const neutral = turn.status === 'not_on_record' || turn.status === 'refused'
  return (
    <article
      className={`space-y-3 rounded-xl border p-3 md:p-4 ${
        turn.status === 'needs_clarification' ? 'border-amber-200 bg-amber-50' : neutral ? 'border-[#e4e8ee] bg-[#f7f9fc]' : 'border-[#e4e8ee] bg-white'
      }`}
      data-testid="nova-answer"
      data-status={turn.status}
    >
      {label && (
        <Badge variant={turn.status === 'needs_clarification' ? 'amber' : 'gray'} data-testid="status-badge">
          {label}
        </Badge>
      )}
      <AnswerText answer={turn.answer} citations={turn.citations} />
      {turn.status === 'needs_clarification' && <p className="text-xs text-amber-800">Reply below and Nova will carry on from here.</p>}

      {turn.citations.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Records cited">
          {turn.citations.map((c) => (
            <li key={c.ref}>
              <CitationChip citation={c} />
            </li>
          ))}
        </ul>
      )}

      {turn.tables.map((t, i) => (
        <ResultTable key={i} table={t} />
      ))}

      <SearchedList searched={turn.searched} defaultOpen={turn.status === 'not_on_record'} />

      {turn.suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Suggestions">
          {turn.suggestions.map((s, i) => {
            const href = safeDashboardPath(s.path)
            return (
              <li key={i}>
                {s.question ? (
                  <button type="button" className={`${chipClass} hover:bg-[#f7f9fc] disabled:opacity-50`} disabled={disabled} onClick={() => onAsk(s.question as string)}>
                    {s.label}
                  </button>
                ) : href ? (
                  <Link href={href} className={`${chipClass} hover:bg-[#f7f9fc]`}>
                    {s.label}
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <FeedbackRow feedback={turn.feedback} busy={feedbackBusy} error={feedbackError} onSubmit={(h, n) => onFeedback(turn.turnId, h, n)} />
    </article>
  )
}
