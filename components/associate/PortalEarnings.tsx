'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CircleAlert, FileText, Loader2 } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { humanize } from '@/lib/associate/execution-labels'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { useEntryQueries, useMyCommissions, useMyPayouts, useRaiseCommissionQuery } from '@/lib/commissions/associate-api-client'
import { formatRate } from '@/lib/commissions/rates'
import type { CommissionEntry } from '@/lib/commissions/schemas'
import { fmt, type Messages } from '@/lib/i18n/types'
import { formatInr, isNegativeAmount } from '@/lib/money'

type Copy = Messages['associates']['portal']['earnings']

const PAGE_SIZE = 25
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'

const STATUS_CHIP: Record<string, string> = {
  earned: 'bg-[#f7a800]/15 text-[#7a5200]',
  approved: 'bg-[#2f5daa]/10 text-[#0e2a63]',
  paid: 'bg-emerald-100 text-emerald-800',
  reversed: 'bg-[#111827]/10 text-[#111827]/70',
}

/** A decimal string as money; a deduction is shown with a minus sign and in red. */
function Money({ value, className = '' }: { value: string | null | undefined; className?: string }) {
  const negative = isNegativeAmount(value)
  return (
    <span className={`${negative ? 'text-red-700' : ''} ${className}`} data-negative={negative ? 'true' : undefined}>
      {formatInr(value)}
    </span>
  )
}

function Tile({ label, hint, children, testId }: { label: string; hint?: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-xl border border-[#e4e8ee] bg-white px-3 py-3" data-testid={testId}>
      <dt className="font-utility text-xs text-[#111827]/70">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-bold text-[#0e2a63]">{children}</dd>
      {hint && <p className="mt-0.5 font-utility text-[11px] leading-snug text-[#111827]/65">{hint}</p>}
    </div>
  )
}

// ── Raise a query ───────────────────────────────────────────────────────────

function QueryDialog({ entry, copy, open, onOpenChange, onSent }: { entry: CommissionEntry; copy: Copy; open: boolean; onOpenChange: (o: boolean) => void; onSent: () => void }) {
  const raise = useRaiseCommissionQuery()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const errorId = `${id}-error`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text) {
      setError(copy.query.required)
      field.current?.focus()
      return
    }
    setError(null)
    try {
      await raise.mutateAsync({ entryId: entry.entry_id, message: text })
      setMessage('')
      onOpenChange(false)
      onSent()
    } catch (err) {
      const code = err instanceof ApiError && typeof err.structuredDetail?.code === 'string' ? err.structuredDetail.code : ''
      const known = copy.query.errors as Record<string, string>
      setError(known[code] ?? copy.query.errors.generic)
      field.current?.focus()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.query.title}</DialogTitle>
          <DialogDescription>{entry.customer_name ?? entry.project_reference_id ?? fmt(copy.entry.payment, { id: entry.payment_id ?? entry.entry_id })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
          <div>
            <label htmlFor={`${id}-msg`} className="block font-utility text-sm font-medium text-[#091c3c]">
              {copy.query.label}
            </label>
            <textarea
              id={`${id}-msg`}
              ref={field}
              rows={5}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-hint ${errorId}` : `${id}-hint`}
              className="mt-1.5 w-full rounded-xl border border-[#e4e8ee] px-3 py-2 text-base text-[#111827] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa]"
            />
            <p id={`${id}-hint`} className="mt-1 font-utility text-xs text-[#111827]/65">
              {copy.query.hint}
            </p>
          </div>
          <p id={errorId} role="alert" className={error ? 'font-utility text-sm text-red-700' : 'sr-only'}>
            {error}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => onOpenChange(false)} className={`min-h-[44px] rounded-lg px-4 font-utility text-sm font-semibold text-[#0e2a63] ${FOCUS}`}>
              {copy.query.cancel}
            </button>
            <button type="submit" disabled={raise.isPending} className={`min-h-[44px] rounded-lg bg-[#0e2a63] px-5 font-utility text-sm font-semibold text-white disabled:opacity-50 ${FOCUS}`}>
              {raise.isPending ? copy.query.sending : copy.query.submit}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function QueryHistory({ entryId, copy }: { entryId: number; copy: Copy }) {
  const { data, isLoading, error } = useEntryQueries(entryId, true)
  if (isLoading) return <p role="status" className="font-utility text-xs text-[#111827]/65">{copy.query.loading}</p>
  if (error) return <DashboardError error={error} />
  if (!data || data.items.length === 0) return <p className="font-utility text-xs text-[#111827]/65">{copy.query.empty}</p>
  return (
    <ul className="space-y-3" aria-label={copy.query.view}>
      {data.items.map((q) => (
        <li key={q.query_id} className="rounded-lg bg-[#f7f9fc] p-3 text-sm" data-testid="query-item">
          <p className="font-utility text-xs font-semibold text-[#111827]/70">{copy.query.yourQuery} · {formatDate(q.created_at)}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-[#111827]">{q.message}</p>
          {q.response ? (
            <div className="mt-2 border-t border-[#e4e8ee] pt-2">
              <p className="font-utility text-xs font-semibold text-emerald-800">{copy.query.reply}{q.responded_at ? ` · ${fmt(copy.query.repliedOn, { date: formatDate(q.responded_at) })}` : ''}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[#111827]">{q.response}</p>
            </div>
          ) : (
            <p className="mt-2 font-utility text-xs text-[#7a5200]">
              {copy.query.waiting}{q.due_at ? ` · ${fmt(copy.query.due, { date: formatDate(q.due_at) })}` : ''}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

// ── One earning ─────────────────────────────────────────────────────────────

function EntryCard({ entry, copy, highlighted, now }: { entry: CommissionEntry; copy: Copy; highlighted: boolean; now: number }) {
  const [asking, setAsking] = useState(false)
  const [showQueries, setShowQueries] = useState(highlighted)
  const [sent, setSent] = useState(false)
  const reasonId = useId()
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView?.({ block: 'center' })
  }, [highlighted])

  const deduction = entry.kind === 'reversal' || entry.kind === 'recovery'
  const rolesCopy = copy.roles as Record<string, string>
  const statusCopy = copy.status as Record<string, string>
  const kindsCopy = copy.kinds as Record<string, string>
  const pendingCopy = copy.pending as Record<string, string>
  const closes = entry.query?.window_closes_at ?? null
  const windowClosed = closes != null && Date.parse(closes) < now
  const queryOpen = !!entry.query?.open
  const title = entry.customer_name ?? entry.project_reference_id ?? fmt(copy.entry.payment, { id: entry.payment_id ?? entry.entry_id })

  return (
    <li
      ref={ref}
      id={`entry-${entry.entry_id}`}
      data-testid="earning-entry"
      data-kind={entry.kind}
      className={`rounded-2xl border bg-white p-4 ${highlighted ? 'border-[#f7a800] ring-2 ring-[#f7a800]/30' : 'border-[#e4e8ee]'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-[#091c3c]">{title}</p>
          <p className="font-utility text-xs text-[#111827]/65">
            {entry.project_reference_id && entry.customer_name ? `${entry.project_reference_id} · ` : ''}
            {formatDate(entry.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {deduction && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 font-utility text-xs font-semibold text-red-800" data-testid="deduction-chip">
              {kindsCopy[entry.kind] ?? humanize(entry.kind)}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-1 font-utility text-xs font-semibold ${STATUS_CHIP[entry.status] ?? STATUS_CHIP.reversed}`}>
            {statusCopy[entry.status] ?? humanize(entry.status)}
          </span>
        </div>
      </div>

      <div className="mt-3">
        {entry.amount != null ? (
          <p className="font-display text-xl font-bold text-[#0e2a63]" data-testid="entry-amount">
            <Money value={entry.amount} />
            {isNegativeAmount(entry.amount) && <span className="ml-2 font-utility text-xs font-semibold text-red-700">{copy.entry.minus}</span>}
          </p>
        ) : (
          <div data-testid="rate-pending">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-utility text-sm font-semibold text-amber-900">
              <CircleAlert className="h-4 w-4" aria-hidden="true" /> {copy.entry.ratePending}
            </p>
            <p className="mt-1.5 font-utility text-xs text-[#111827]/70">{pendingCopy[entry.pending_reason ?? ''] ?? pendingCopy.generic}</p>
          </div>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="font-utility text-xs text-[#111827]/65">{copy.entry.role}</dt>
          <dd className="text-[#111827]">{rolesCopy[entry.earning_role] ?? humanize(entry.earning_role)}</dd>
        </div>
        {entry.basis_amount != null && (
          <div>
            <dt className="font-utility text-xs text-[#111827]/65">{copy.entry.basis}</dt>
            <dd className="text-[#111827]">{formatInr(entry.basis_amount)}</dd>
          </div>
        )}
        {entry.rate_percent != null && (
          <div>
            <dt className="font-utility text-xs text-[#111827]/65">{copy.entry.rate}</dt>
            <dd className="text-[#111827]">{formatRate(entry.rate_percent)}</dd>
          </div>
        )}
      </dl>

      <ul className="mt-2 space-y-0.5 font-utility text-xs text-[#111827]/70">
        {entry.payment_id != null && <li>{fmt(copy.entry.payment, { id: entry.payment_id })}</li>}
        {entry.holders != null && entry.holders > 1 && <li>{fmt(copy.entry.sharedEqually, { count: entry.holders })}</li>}
        {entry.agreement_date && <li>{fmt(copy.entry.rateDate, { date: formatDate(entry.agreement_date) })}</li>}
        {entry.reverses_entry_id != null && <li>{fmt(copy.entry.reversalOf, { id: entry.reverses_entry_id })}</li>}
        {entry.reversed_by_entry_id != null && <li>{fmt(copy.entry.reversedBy, { id: entry.reversed_by_entry_id })}</li>}
        {entry.batch && <li>{fmt(copy.entry.inPayout, { period: entry.batch.period })}</li>}
        {entry.reason && <li>{fmt(copy.entry.reason, { reason: entry.reason })}</li>}
      </ul>

      {entry.query && (
        <div className="mt-3 border-t border-[#e4e8ee] pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              disabled={queryOpen || windowClosed}
              aria-describedby={queryOpen || windowClosed ? reasonId : undefined}
              onClick={() => setAsking(true)}
              className={`min-h-[44px] rounded-lg border border-[#0e2a63] px-4 font-utility text-sm font-semibold text-[#0e2a63] disabled:border-[#e4e8ee] disabled:text-[#111827]/50 ${FOCUS}`}
            >
              {queryOpen ? copy.query.open : copy.query.raise}
            </button>
            <button
              type="button"
              aria-expanded={showQueries}
              onClick={() => setShowQueries((v) => !v)}
              className={`min-h-[44px] font-utility text-sm font-semibold text-[#0e2a63] underline ${FOCUS}`}
            >
              {showQueries ? copy.query.hide : copy.query.view}
            </button>
          </div>
          <p id={reasonId} className="font-utility text-xs text-[#111827]/70" data-testid="query-window-note">
            {windowClosed ? fmt(copy.query.windowClosed, { date: formatDate(closes) }) : closes && !queryOpen ? fmt(copy.query.windowOpen, { date: formatDate(closes) }) : ''}
          </p>
          <p role="status" className={sent ? 'mt-1 font-utility text-sm text-emerald-800' : 'sr-only'}>{sent ? copy.query.sent : ''}</p>
          {showQueries && (
            <div className="mt-2">
              <QueryHistory entryId={entry.entry_id} copy={copy} />
            </div>
          )}
          <QueryDialog entry={entry} copy={copy} open={asking} onOpenChange={setAsking} onSent={() => { setSent(true); setShowQueries(true) }} />
        </div>
      )}
    </li>
  )
}

// ── Pager ───────────────────────────────────────────────────────────────────

function Pager({ page, total, copy, onPage }: { page: number; total: number; copy: Copy; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) return null
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label={copy.listLabel}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`min-h-[44px] rounded-lg border border-[#e4e8ee] bg-white px-4 font-utility text-sm font-semibold text-[#0e2a63] disabled:opacity-40 ${FOCUS}`}>
        {copy.pager.previous}
      </button>
      <span className="font-utility text-xs text-[#111827]/70" aria-live="polite">{fmt(copy.pager.page, { page, pages })}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={`min-h-[44px] rounded-lg border border-[#e4e8ee] bg-white px-4 font-utility text-sm font-semibold text-[#0e2a63] disabled:opacity-40 ${FOCUS}`}>
        {copy.pager.next}
      </button>
    </nav>
  )
}

// ── Payouts ─────────────────────────────────────────────────────────────────

function Payouts({ copy }: { copy: Copy }) {
  const { data, isLoading, error, refetch } = useMyPayouts()
  if (isLoading) return <div role="status" aria-busy="true" className="space-y-3"><div className="h-32 animate-pulse rounded-2xl bg-[#eef1f6]" /><span className="sr-only">{copy.loading}</span></div>
  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (!data || data.items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-6 text-center text-sm text-[#111827]/70" data-testid="payouts-empty">{copy.payouts.empty}</p>
  }
  const statusCopy = copy.payouts.status as Record<string, string>
  return (
    <ul className="space-y-3" aria-label={copy.payouts.listLabel}>
      {data.items.map((p) => (
        <li key={`${p.batch_id}-${p.line_id ?? ''}`} className="rounded-2xl border border-[#e4e8ee] bg-white p-4" data-testid="payout-item">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-base font-semibold text-[#091c3c]">{p.period}</p>
            <span className={`rounded-full px-2.5 py-1 font-utility text-xs font-semibold ${p.status === 'paid' ? STATUS_CHIP.paid : STATUS_CHIP.approved}`}>
              {statusCopy[p.status] ?? humanize(p.status)}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Row label={copy.payouts.gross}><Money value={p.gross} /></Row>
            <Row label={copy.payouts.recoveries}><Money value={p.recoveries} /></Row>
            <Row label={copy.payouts.carriedIn}><Money value={p.carried_in} /></Row>
            <Row label={p.tds_rate_percent ? fmt(copy.payouts.tdsAt, { rate: formatRate(p.tds_rate_percent) }) : copy.payouts.tds}><Money value={p.tds} /></Row>
            <Row label={copy.payouts.net}><Money value={p.net} className="font-bold text-[#0e2a63]" /></Row>
          </dl>
          <ul className="mt-2 space-y-0.5 font-utility text-xs text-[#111827]/70">
            {p.paid_at && <li>{fmt(copy.payouts.paidOn, { date: formatDate(p.paid_at) })}</li>}
            {p.bank_account_last4 && <li>{fmt(copy.payouts.bank, { last4: p.bank_account_last4 })}</li>}
            {p.bank_reference && <li>{fmt(copy.payouts.reference, { reference: p.bank_reference })}</li>}
            {isNonZero(p.carry_forward) && <li>{fmt(copy.payouts.carryForward, { amount: formatInr(p.carry_forward) })}</li>}
          </ul>
        </li>
      ))}
    </ul>
  )
}

const isNonZero = (a: string | null | undefined) => !!a && /[1-9]/.test(a)

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-utility text-xs text-[#111827]/65">{label}</dt>
      <dd className="text-[#111827]">{children}</dd>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PortalEarnings({ copy, policyHref, territory = false }: { copy: Copy; policyHref: string; territory?: boolean }) {
  const sp = useSearchParams()
  const tab = sp.get('tab') === 'payouts' ? 'payouts' : 'earnings'
  const focusEntry = Number(sp.get('entry')) || null
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'earnings' | 'payouts'>(tab)
  const filterId = useId()
  // Read once per visit: whether a query window has closed never changes while the page is open.
  const [now] = useState(() => Date.now())
  const { data, isLoading, error, refetch, isFetching } = useMyCommissions({ status: filter || undefined, page, page_size: PAGE_SIZE })

  if (error && !data) return <DashboardError error={error} onRetry={() => void refetch()} />

  const s = data?.summary
  const filtersCopy = copy.filters as Record<string, string>

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
        <p className="mt-1 font-utility text-sm text-[#111827]/70">{copy.intro}</p>
        {/* A Preferred Associate also sees their territory's earnings (the server decides which entries come back). */}
        {territory && <p className="mt-1 font-utility text-sm text-[#111827]/70" data-testid="territory-note">{copy.territoryNote}</p>}
      </div>

      {isLoading || !s ? (
        <div role="status" aria-busy="true" className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-[#eef1f6]" />)}
          <span className="sr-only">{copy.loading}</span>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2" data-testid="earnings-tiles">
            <Tile label={copy.tiles.earned} hint={copy.tiles.earnedHint} testId="tile-earned"><Money value={s.earned} /></Tile>
            <Tile label={copy.tiles.approved} hint={copy.tiles.approvedHint} testId="tile-approved"><Money value={s.approved} /></Tile>
            <Tile label={copy.tiles.paid} hint={copy.tiles.paidHint} testId="tile-paid"><Money value={s.paid} /></Tile>
            <Tile label={fmt(copy.tiles.fyTds, { year: s.financial_year ?? '' })} hint={copy.tiles.fyTdsHint} testId="tile-tds"><Money value={s.fy_tds_deducted} /></Tile>
            {isNonZero(s.to_recover) && <Tile label={copy.tiles.toRecover} hint={copy.tiles.toRecoverHint} testId="tile-recover"><Money value={s.to_recover} /></Tile>}
            {s.next_payout && (
              <div className="col-span-2 rounded-xl border border-[#e4e8ee] bg-white px-3 py-3" data-testid="tile-next-payout">
                <dt className="font-utility text-xs text-[#111827]/70">{copy.tiles.nextPayout}</dt>
                <dd className="mt-0.5 font-utility text-sm font-semibold text-[#0e2a63]">
                  {fmt(copy.tiles.nextPayoutBody, { period: s.next_payout.period, date: formatDate(s.next_payout.expected_by) })}
                </dd>
              </div>
            )}
          </dl>
          {s.pending_count > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 font-utility text-sm text-amber-900" data-testid="pending-count">
              {fmt(copy.tiles.waiting, { count: s.pending_count })}
            </p>
          )}
        </>
      )}

      <Link href={policyHref} className={`inline-flex min-h-[44px] items-center gap-2 font-utility text-sm font-semibold text-[#0e2a63] underline ${FOCUS}`}>
        <FileText className="h-4 w-4" aria-hidden="true" /> {copy.policy}
      </Link>

      <div className="flex gap-2" role="group" aria-label={copy.tabsLabel}>
        {(['earnings', 'payouts'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={activeTab === t}
            onClick={() => setActiveTab(t)}
            className={`min-h-[44px] flex-1 rounded-xl px-4 font-utility text-sm font-semibold ${FOCUS} ${activeTab === t ? 'bg-[#0e2a63] text-white' : 'border border-[#e4e8ee] bg-white text-[#0e2a63]'}`}
          >
            {copy.tabs[t]}
          </button>
        ))}
      </div>

      {activeTab === 'payouts' ? (
        <Payouts copy={copy} />
      ) : (
        <section aria-busy={isFetching} className="space-y-3">
          <div>
            <label htmlFor={filterId} className="mr-2 font-utility text-sm text-[#111827]/70">{copy.filterLabel}</label>
            <select
              id={filterId}
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1) }}
              className={`min-h-[44px] rounded-lg border border-[#e4e8ee] bg-white px-3 text-base ${FOCUS}`}
            >
              {['', 'earned', 'approved', 'paid', 'reversed'].map((v) => <option key={v} value={v}>{filtersCopy[v || 'all']}</option>)}
            </select>
            {isFetching && !isLoading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-[#111827]/50" aria-hidden="true" />}
          </div>
          {error && <DashboardError error={error} onRetry={() => void refetch()} />}
          {isLoading ? (
            <div className="space-y-3"><div className="h-40 animate-pulse rounded-2xl bg-[#eef1f6]" /></div>
          ) : data && data.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-6 text-center text-sm text-[#111827]/70" data-testid="earnings-empty">
              {filter ? copy.emptyFiltered : copy.empty}
            </p>
          ) : (
            <ul className="space-y-3" aria-label={copy.listLabel}>
              {data?.items.map((e) => <EntryCard key={e.entry_id} entry={e} copy={copy} highlighted={focusEntry === e.entry_id} now={now} />)}
            </ul>
          )}
          {data && <Pager page={page} total={data.total} copy={copy} onPage={setPage} />}
        </section>
      )}
    </div>
  )
}
