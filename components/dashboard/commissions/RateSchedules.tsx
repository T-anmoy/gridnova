'use client'

import { useId, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { commissionErrorMessage } from '@/lib/commissions/labels'
import { effectiveFromProblem, formatRate, isValidRate, rateKeyLabel } from '@/lib/commissions/rates'
import type { RateSchedule, RateSchedules as RateSchedulesData } from '@/lib/commissions/schemas'
import { ApiError } from '@/lib/dashboard/api-error'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { formatDate, formatDatetime, istDateKey } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { usePublishRateSchedule, useRateSchedules, useReRate } from '@/lib/commissions/staff-api-client'

function ScheduleCard({ schedule, rateKeys, inForce, today, isAdmin, onReRate }: { schedule: RateSchedule; rateKeys: string[]; inForce: boolean; today: string; isAdmin: boolean; onReRate: (s: RateSchedule) => void }) {
  const upcoming = schedule.effective_from > today
  return (
    <Card data-testid="schedule-card" data-placeholder={schedule.is_placeholder ? 'true' : undefined}>
      <CardHeader className="gap-2 p-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Version {schedule.version}</CardTitle>
          {inForce && <Badge variant="green">In force</Badge>}
          {upcoming && <Badge variant="blue">Starts {formatDate(schedule.effective_from)}</Badge>}
          {schedule.is_placeholder && <Badge variant="orange" data-testid="placeholder-badge">Placeholder — not real rates</Badge>}
        </div>
        <p className="text-xs text-gray-500">
          Effective from {formatDate(schedule.effective_from)} · published {formatDatetime(schedule.published_at)}
          {schedule.published_by ? ` by ${schedule.published_by}` : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {schedule.is_placeholder && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            A placeholder schedule is not a real rate card. Entries are not rated from it, so they stay at “Rate to be published” and no payout can include them.
          </p>
        )}
        {schedule.note && <p className="text-sm text-gray-700">{schedule.note}</p>}
        <details>
          <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-medium text-[#0e2a63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">Show rates</summary>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {rateKeys.map((k) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[#e4e8ee] py-1">
                <dt className="text-gray-600">{rateKeyLabel(k)}</dt>
                <dd className="font-medium">{formatRate(schedule.rates[k])}</dd>
              </div>
            ))}
          </dl>
        </details>
        {isAdmin && !schedule.is_placeholder && (
          <Button variant="outline" className="h-11 md:h-9" onClick={() => onReRate(schedule)}>
            Re-rate pending entries…
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

interface FormErrors {
  date?: string
  rates: Record<string, string>
  general?: string
}

function PublishForm({ data, today }: { data: RateSchedulesData; today: string }) {
  const publish = usePublishRateSchedule()
  const id = useId()
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [isPlaceholder, setIsPlaceholder] = useState(false)
  const [note, setNote] = useState('')
  const [rates, setRates] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<FormErrors>({ rates: {} })
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const real = data.items.filter((s) => !s.is_placeholder)
  const nextVersion = Math.max(0, ...data.items.map((s) => s.version)) + 1
  const dateId = `${id}-date`
  const min = isPlaceholder ? today : data.earliest_effective_from

  function validate(): FormErrors {
    const next: FormErrors = { rates: {} }
    const problem = effectiveFromProblem({ effectiveFrom, isPlaceholder, earliestEffectiveFrom: data.earliest_effective_from, todayIst: today })
    if (problem === 'required') next.date = 'Choose the date this schedule starts.'
    else if (problem === 'notice_period') next.date = `A real schedule needs notice: it cannot start before ${formatDate(data.earliest_effective_from)}.`
    else if (problem === 'effective_in_past') next.date = 'A placeholder schedule cannot start in the past.'
    for (const k of data.rate_keys) {
      const v = (rates[k] ?? '').trim()
      if (v === '') next.rates[k] = 'Enter a rate.'
      else if (!isValidRate(v)) next.rates[k] = 'Between 0 and 100, up to 4 decimals.'
    }
    return next
  }

  function focusFirst(e: FormErrors) {
    const firstRate = data.rate_keys.find((k) => e.rates[k])
    const target = e.date ? dateId : firstRate ? `${id}-rate-${firstRate}` : null
    if (target) document.getElementById(target)?.focus()
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setDone(null)
    const next = validate()
    setErrors(next)
    if (next.date || Object.keys(next.rates).length > 0) {
      focusFirst(next)
      return
    }
    setConfirming(true)
  }

  async function doPublish() {
    try {
      const s = await publish.mutateAsync({
        effective_from: effectiveFrom,
        is_placeholder: isPlaceholder,
        rates: Object.fromEntries(data.rate_keys.map((k) => [k, (rates[k] ?? '').trim()])),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      setDone(`Published version ${s.version}, effective from ${formatDate(s.effective_from)}.`)
      setErrors({ rates: {} })
      setRates({})
      setEffectiveFrom('')
      setNote('')
    } catch (err) {
      // The server's refusal stays visible, attached to the field it names where it names one.
      const next: FormErrors = { rates: {} }
      const d = err instanceof ApiError ? err.structuredDetail : undefined
      const code = typeof d?.code === 'string' ? d.code : ''
      const message = commissionErrorMessage(err)
      const field = typeof d?.field === 'string' ? d.field : ''
      if (code === 'notice_period' || code === 'effective_in_past') next.date = message
      else if (code === 'invalid_rate' && field.startsWith('rates.')) next.rates[field.slice(6)] = message
      else next.general = message
      setErrors(next)
      throw err
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Publish a new schedule</CardTitle>
        <p className="text-sm text-gray-500">A schedule is never edited — this publishes version {nextVersion}. Every rate is a percentage of the verified amount without GST.</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Publish a rate schedule">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={dateId} className="mb-1 block text-sm font-medium text-gray-700">Effective from *</label>
              <Input
                id={dateId}
                type="date"
                min={min}
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                aria-invalid={errors.date ? true : undefined}
                aria-describedby={`${dateId}-hint${errors.date ? ` ${dateId}-err` : ''}`}
                className="h-11 md:h-9"
              />
              <p id={`${dateId}-hint`} className="mt-1 text-xs text-gray-500" data-testid="notice-hint">
                {isPlaceholder ? `A placeholder can start today (${formatDate(today)}) or later.` : `Earliest allowed: ${formatDate(data.earliest_effective_from)} (the notice period).`}
              </p>
              {errors.date && <p id={`${dateId}-err`} role="alert" className="mt-1 text-sm text-red-600">{errors.date}</p>}
            </div>
            <div className="flex items-start gap-3 pt-6">
              <input id={`${id}-ph`} type="checkbox" className="mt-1 h-5 w-5" checked={isPlaceholder} onChange={(e) => setIsPlaceholder(e.target.checked)} />
              <label htmlFor={`${id}-ph`} className="text-sm text-gray-700">
                This is a placeholder schedule, not real rates
              </label>
            </div>
          </div>

          {real.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Start from the rates of</span>
              {real.map((s) => (
                <Button key={s.schedule_id} type="button" variant="outline" size="sm" className="min-h-[44px] md:min-h-0" onClick={() => setRates({ ...s.rates })}>
                  Version {s.version}
                </Button>
              ))}
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-gray-700">Rates (% of the verified amount without GST) *</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.rate_keys.map((k) => {
                const inputId = `${id}-rate-${k}`
                const err = errors.rates[k]
                return (
                  <div key={k}>
                    <label htmlFor={inputId} className="mb-1 block text-sm text-gray-700">{rateKeyLabel(k)}</label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={inputId}
                        inputMode="decimal"
                        autoComplete="off"
                        value={rates[k] ?? ''}
                        onChange={(e) => setRates((r) => ({ ...r, [k]: e.target.value }))}
                        aria-invalid={err ? true : undefined}
                        aria-describedby={err ? `${inputId}-err` : undefined}
                        className="h-11 md:h-9"
                      />
                      <span aria-hidden="true" className="text-sm text-gray-500">%</span>
                    </div>
                    {err && <p id={`${inputId}-err`} role="alert" className="mt-1 text-xs text-red-600">{err}</p>}
                  </div>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${id}-note`} className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea id={`${id}-note`} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-base md:text-sm" />
          </div>

          {errors.general && <p role="alert" className="text-sm text-red-600">{errors.general}</p>}
          {done && <p role="status" className="text-sm text-green-700">{done}</p>}
          <Button type="submit" className="h-11 md:h-9" disabled={publish.isPending}>Review and publish…</Button>
        </form>
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Publish version ${nextVersion}?`}
        description={
          isPlaceholder
            ? `A placeholder schedule starting ${formatDate(effectiveFrom)}. It is not real rates and cannot be edited afterwards.`
            : `These rates apply to agreements signed from ${formatDate(effectiveFrom)}. A published schedule cannot be edited — only superseded by a later one.`
        }
        confirmLabel="Publish schedule"
        describeError={commissionErrorMessage}
        onConfirm={doPublish}
      />
    </Card>
  )
}

export default function RateSchedules() {
  const { role } = useStaffRole()
  const isAdmin = role === 'admin'
  const { data, isLoading, error, refetch } = useRateSchedules()
  const reRate = useReRate()
  const [target, setTarget] = useState<RateSchedule | null>(null)
  const [result, setResult] = useState<string | null>(null)
  // Read once per visit: the notice period is measured from today in IST.
  const [today] = useState(() => istDateKey(new Date()))

  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) return <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>

  const noReal = data.items.every((s) => s.is_placeholder)
  return (
    <div className="space-y-4">
      {noReal && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="no-real-schedule">
          No real rate schedule has been published yet, so commission entries are recorded without an amount and no payout can include them.
        </p>
      )}
      {result && <p role="status" className="rounded-lg border border-[#e4e8ee] bg-white px-4 py-2 text-sm text-gray-800" data-testid="rerate-result">{result}</p>}
      <div className="space-y-3">
        {data.items.length === 0 && <p className="text-sm text-gray-500">No schedules yet.</p>}
        {data.items.map((s) => (
          <ScheduleCard key={s.schedule_id} schedule={s} rateKeys={data.rate_keys} inForce={s.schedule_id === data.in_force_schedule_id} today={today} isAdmin={isAdmin} onReRate={setTarget} />
        ))}
      </div>
      {isAdmin ? <PublishForm data={data} today={today} /> : <p className="text-sm text-gray-500">Only an Admin can publish a rate schedule.</p>}
      <ReasonDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Re-rate pending entries from version ${target?.version ?? ''}`}
        description="Rates every earning that is waiting for confirmed rates — at the schedule in force on its agreement date when that is a real schedule, otherwise at this one. The action is audited."
        label="Reason (recorded in the audit log)"
        required
        confirmLabel="Re-rate entries"
        describeError={commissionErrorMessage}
        onConfirm={async (reason) => {
          const r = await reRate.mutateAsync({ scheduleId: target!.schedule_id, reason })
          setResult(`Rated ${r.rated} ${r.rated === 1 ? 'entry' : 'entries'} (${formatInr(r.total_amount)} in total); ${r.still_pending} still waiting.`)
        }}
      />
    </div>
  )
}
