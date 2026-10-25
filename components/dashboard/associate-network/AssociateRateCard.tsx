'use client'

import { useId, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { useAssociateRate, useSetAssociateRate } from '@/lib/commissions/staff-api-client'
import {
  STEP_LABEL,
  earliestDate,
  fromUnits,
  historyLines,
  individualRateError,
  isReduction,
  stepRate,
  toUnits,
  validateRateForm,
  type RateField,
  type RateFormProblems,
} from '@/lib/commissions/individual-rate'
import { formatRate, rateKeyLabel } from '@/lib/commissions/rates'
import type { AssociateRate } from '@/lib/commissions/schemas'
import DateField from '@/components/forms/DateField'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'
const STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', in_force: 'In force', superseded: 'Replaced' }
const STATUS_VARIANT: Record<string, 'blue' | 'green' | 'gray'> = { scheduled: 'blue', in_force: 'green', superseded: 'gray' }

const plain = (v: string | null | undefined): string => {
  const u = toUnits(v)
  return u === null ? '' : fromUnits(u)
}

/** A rate as text with its percent sign; plain words when there is none. */
const rateOrNone = (v: string | null | undefined, none: string): string => (v == null ? none : formatRate(v))

function SourceTag({ source }: { source: string | null | undefined }) {
  if (source === 'individual') return <Badge variant="blue" data-testid="rate-source-tag">Individual rate</Badge>
  if (source === 'standard') return <Badge variant="gray" data-testid="rate-source-tag">Standard rate</Badge>
  return null
}

function Fact({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId}>
      <dt className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/65">{label}</dt>
      <dd className="mt-0.5 font-utility text-sm text-[#091c3c]">{children}</dd>
    </div>
  )
}

// ── Change-rate dialog ─────────────────────────────────────────────────────

function ChangeRateDialog({ rate, associateId, mode, open, onOpenChange, onSaved }: { rate: AssociateRate; associateId: string; mode: 'set' | 'standard'; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (message: string) => void }) {
  const save = useSetAssociateRate(associateId)
  const id = useId()
  const [rateText, setRateText] = useState(() => plain(rate.effective.rate_percent))
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [problems, setProblems] = useState<RateFormProblems>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'confirm'>('form')

  const next = mode === 'standard' ? null : rateText.trim()
  const min = earliestDate(next, rate)
  // Until the Admin picks a date, the earliest allowed one is used — it follows the direction of the change.
  const effectiveFrom = date || min
  const reduction = isReduction(next, rate)
  const fieldId = (f: RateField) => `${id}-${f}`

  function reviewIt(e: React.FormEvent) {
    e.preventDefault()
    setGeneral(null)
    const found = validateRateForm({ next, effectiveFrom, reason }, rate)
    setProblems(found)
    const first = (['rate_percent', 'effective_from', 'reason'] as const).find((f) => found[f])
    if (first) {
      document.getElementById(fieldId(first))?.focus()
      return
    }
    setStep('confirm')
  }

  async function confirm() {
    setGeneral(null)
    try {
      await save.mutateAsync({ rate_percent: next, effective_from: effectiveFrom, reason: reason.trim() })
      onSaved(`Saved: ${describeChange(rate, next, effectiveFrom)}`)
      onOpenChange(false)
    } catch (err) {
      const { field, message } = individualRateError(err)
      if (field === 'general') setGeneral(message)
      else setProblems({ [field]: message })
      setStep('form')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        {step === 'form' ? (
          <form onSubmit={reviewIt} noValidate className="space-y-4" aria-label="Change commission rate">
            <DialogHeader>
              <DialogTitle>{mode === 'standard' ? 'Return to the standard rate' : 'Change commission rate'}</DialogTitle>
              <DialogDescription>
                {rate.full_name} · {rateKeyLabel(rate.rate_key)}. Now: {rateOrNone(rate.effective.rate_percent, 'no confirmed rate')}.
              </DialogDescription>
            </DialogHeader>

            {mode === 'set' && (
              <div>
                <label htmlFor={fieldId('rate_percent')} className="mb-1 block text-sm font-medium text-gray-700">New rate (% of the verified amount without GST)</label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="h-11 min-w-[64px] md:h-9" aria-label={`Lower by ${STEP_LABEL}`} onClick={() => setRateText((v) => stepRate(v, -1))}>
                    −{STEP_LABEL}
                  </Button>
                  <Input
                    id={fieldId('rate_percent')}
                    inputMode="decimal"
                    autoComplete="off"
                    value={rateText}
                    onChange={(e) => setRateText(e.target.value)}
                    aria-invalid={problems.rate_percent ? true : undefined}
                    aria-describedby={problems.rate_percent ? `${fieldId('rate_percent')}-err` : undefined}
                    className="h-11 text-center md:h-9"
                  />
                  <Button type="button" variant="outline" className="h-11 min-w-[64px] md:h-9" aria-label={`Raise by ${STEP_LABEL}`} onClick={() => setRateText((v) => stepRate(v, 1))}>
                    +{STEP_LABEL}
                  </Button>
                </div>
                {problems.rate_percent && <p id={`${fieldId('rate_percent')}-err`} role="alert" className="mt-1 text-sm text-red-600">{problems.rate_percent}</p>}
              </div>
            )}
            {mode === 'standard' && (
              <p className="rounded-lg bg-[#f7f9fc] px-3 py-2 text-sm text-gray-700" data-testid="standard-note">
                The Associate goes back to the standard schedule{rate.standard?.rate_percent ? `, now ${formatRate(rate.standard.rate_percent)}` : ''}.
              </p>
            )}

            <div>
              <label htmlFor={fieldId('effective_from')} className="mb-1 block text-sm font-medium text-gray-700">Starts on</label>
              <DateField
                id={fieldId('effective_from')}
                variant="dashboard"
                label="Starts on"
                min={min}
                value={effectiveFrom}
                onChange={setDate}
                aria-invalid={problems.effective_from ? true : undefined}
                aria-describedby={`${fieldId('effective_from')}-hint${problems.effective_from ? ` ${fieldId('effective_from')}-err` : ''}`}
              />
              <p id={`${fieldId('effective_from')}-hint`} className="mt-1 text-xs text-gray-500" data-testid="date-hint">
                {reduction ? `A lower rate needs notice: ${rate.notice.notice_days} days, so the earliest date is ${formatDate(min)}.` : `Earliest date for this change: ${formatDate(min)}.`}
              </p>
              {problems.effective_from && <p id={`${fieldId('effective_from')}-err`} role="alert" className="mt-1 text-sm text-red-600">{problems.effective_from}</p>}
            </div>

            <div>
              <label htmlFor={fieldId('reason')} className="mb-1 block text-sm font-medium text-gray-700">Reason (kept internal; the Associate never sees it)</label>
              <textarea
                id={fieldId('reason')}
                rows={3}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={problems.reason ? true : undefined}
                aria-describedby={problems.reason ? `${fieldId('reason')}-err` : undefined}
                className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-base md:text-sm"
              />
              {problems.reason && <p id={`${fieldId('reason')}-err`} role="alert" className="mt-1 text-sm text-red-600">{problems.reason}</p>}
            </div>

            {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="h-11 md:h-9">Review change…</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4" data-testid="confirm-step">
            <DialogHeader>
              <DialogTitle>Confirm the new rate</DialogTitle>
              <DialogDescription>{rate.full_name} · {rateKeyLabel(rate.rate_key)}</DialogDescription>
            </DialogHeader>
            <p className="font-display text-lg font-semibold text-[#0e2a63]" data-testid="confirm-change">{describeChange(rate, next, effectiveFrom)}</p>
            <p className="text-sm text-gray-700" data-testid="confirm-explain">
              It applies to customers whose agreement is signed on or after {formatDate(effectiveFrom)}. Commission already recorded never changes. The Associate can see the new rate and the date, never your reason.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11 md:h-9" disabled={save.isPending} onClick={() => setStep('form')}>Back</Button>
              <Button type="button" className="h-11 md:h-9" disabled={save.isPending} onClick={() => void confirm()}>
                {save.isPending ? 'Saving…' : 'Confirm rate change'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** One sentence naming the old rate, the new rate and the date the new one starts. */
function describeChange(rate: AssociateRate, next: string | null, date: string): string {
  const from = rateOrNone(rate.effective.rate_percent, 'no confirmed rate')
  const to = next === null ? `the standard rate${rate.standard?.rate_percent ? ` (${formatRate(rate.standard.rate_percent)})` : ''}` : formatRate(next)
  return `Rate changes from ${from} to ${to} from ${formatDate(date)}.`
}

// ── The card ───────────────────────────────────────────────────────────────

export default function AssociateRateCard({ associateId, canEdit }: { associateId: string; canEdit: boolean }) {
  const { data: rate, isLoading, error, refetch } = useAssociateRate(associateId)
  const [dialog, setDialog] = useState<'set' | 'standard' | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  // Other roles are refused by the server (403); the card simply is not there for them.
  if (error instanceof ApiError && error.status === 403) return null
  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !rate) return <Skeleton className="h-48 w-full" />

  const lines = historyLines(rate.history)
  const hasIndividual = rate.individual?.rate_percent != null
  const pending = rate.effective.rate_percent == null

  return (
    <Card className="p-6" data-testid="rate-card" aria-labelledby="rate-card-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="rate-card-title" className="font-display text-sm font-semibold text-[#091c3c]">Commission rate</h2>
          <p className="mt-0.5 font-utility text-xs text-[#111827]/65">{rateKeyLabel(rate.rate_key)} · applies to agreements signed from the start date</p>
        </div>
        <SourceTag source={rate.effective.source} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Fact label="In effect today" testId="rate-effective">
          <span className="font-display text-xl font-bold text-[#0e2a63]">{pending ? 'Not confirmed yet' : formatRate(rate.effective.rate_percent)}</span>
          {rate.effective.effective_from && <span className="block text-xs text-gray-500">since {formatDate(rate.effective.effective_from)}</span>}
        </Fact>
        <Fact label="Standard rate" testId="rate-standard">{rateOrNone(rate.standard?.rate_percent, 'Not confirmed yet')}</Fact>
        <Fact label="Individual rate" testId="rate-individual">{hasIndividual ? formatRate(rate.individual?.rate_percent) : 'None — standard rate applies'}</Fact>
      </dl>

      <div className="mt-4" data-testid="rate-scheduled">
        <h3 className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/65">Scheduled changes</h3>
        {rate.scheduled_changes.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600">None.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {rate.scheduled_changes.map((c) => (
              <li key={`${c.effective_from}-${c.rate_percent}`}>
                From {formatDate(c.effective_from)}: {rateOrNone(c.rate_percent, 'no confirmed rate')}
                {c.source === 'individual' ? ' (individual)' : c.source === 'standard' ? ' (standard)' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      {saved && <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" data-testid="rate-saved">{saved}</p>}

      {canEdit ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button className={`h-11 md:h-9 ${FOCUS}`} onClick={() => { setSaved(null); setDialog('set') }}>Change rate</Button>
            {hasIndividual && <Button variant="outline" className="h-11 md:h-9" onClick={() => { setSaved(null); setDialog('standard') }}>Return to standard rate</Button>}
          </div>
          <p className="text-xs text-gray-500" data-testid="notice-rule">
            {rate.notice.increase_needs_notice
              ? `Any change needs ${rate.notice.notice_days} days’ notice (earliest ${formatDate(rate.notice.increase_earliest_effective_from)}).`
              : `A higher rate can start from ${formatDate(rate.notice.increase_earliest_effective_from)}. A lower rate needs ${rate.notice.notice_days} days’ notice (earliest ${formatDate(rate.notice.reduction_earliest_effective_from)}).`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-gray-500" data-testid="rate-readonly">You can see this rate but only an Admin can change it.</p>
      )}

      <div className="mt-5" data-testid="rate-history">
        <h3 className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/65">History</h3>
        {lines.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600">No individual rate has been set.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#e4e8ee]">
            {lines.map(({ row, before }) => (
              <li key={row.individual_rate_id} className="py-2 text-sm" data-testid="rate-history-row">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{formatDate(row.effective_from)}</span>
                  <span>{rateOrNone(before, 'Standard rate')} → {rateOrNone(row.rate_percent, 'Standard rate')}</span>
                  <Badge variant={STATUS_VARIANT[row.status] ?? 'gray'}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Set by {row.set_by ?? '—'}{row.reason ? ` · ${row.reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && dialog && (
        <ChangeRateDialog key={dialog} rate={rate} associateId={associateId} mode={dialog} open onOpenChange={(o) => !o && setDialog(null)} onSaved={setSaved} />
      )}
    </Card>
  )
}
