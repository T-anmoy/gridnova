'use client'

import { useState } from 'react'
import { Brain } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCustomerMemory } from '@/lib/dashboard/staff-leads-api-client'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import {
  MEMORY_KINDS, MEMORY_LIMIT_DEFAULT, MEMORY_LIMIT_MAX, MEMORY_LIMIT_MIN, clampMemoryLimit, mapMemoryError,
} from '@/lib/dashboard/staff-leads-logic'
import { fmt, type StaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { MemoryItem, MemoryProfile } from '@/lib/dashboard/staff-leads-types'

const CONTROL =
  'min-h-11 rounded-lg border border-[#e4e8ee] bg-white px-3 text-base md:text-sm font-utility text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800]'
// Memory text comes from customers and agents: it is only ever rendered as
// React text (never as HTML) and long unbroken strings wrap instead of
// widening the page.
const TEXT = 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'

/** Customer memory for a lead's customer (Admin, Management, Sales). The caller gates by role. */
export function CustomerMemoryPanel({ customerId, copy }: { customerId: number; copy: StaffLeadsCopy }) {
  const c = copy.memory
  const [kind, setKind] = useState('')
  const [limitText, setLimitText] = useState(String(MEMORY_LIMIT_DEFAULT))
  const debouncedLimit = useDebouncedValue(limitText, 300)
  const limit = clampMemoryLimit(debouncedLimit) ?? MEMORY_LIMIT_DEFAULT
  const { data, isLoading, error, refetch, isFetching } = useCustomerMemory(customerId, { kind: kind || undefined, limit })

  const mapped = error ? mapMemoryError(error) : null
  const retryable = mapped && (mapped.key === 'network' || mapped.key === 'generic' || mapped.key === 'agent')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4" aria-hidden="true" /> {c.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div role="status" aria-label={c.loading} className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : mapped ? (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="font-utility text-sm text-amber-800">{c.errors[mapped.key]}</p>
            {mapped.serverText && <p className={`mt-1 font-utility text-xs text-amber-800 ${TEXT}`}>{mapped.serverText}</p>}
            {retryable && (
              <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => void refetch()}>
                {copy.common.retry}
              </Button>
            )}
          </div>
        ) : data ? (
          <>
            <Profile profile={data.profile} copy={copy} />

            <div>
              <h3 className="font-utility text-sm font-semibold text-[#091c3c]">{c.listTitle}</h3>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="grid gap-1 font-utility text-sm text-[#111827]">
                  {c.kindLabel}
                  <select className={CONTROL} value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value="">{c.allKinds}</option>
                    {MEMORY_KINDS.map((k) => <option key={k} value={k}>{c.kinds[k]}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 font-utility text-sm text-[#111827]">
                  {c.limitLabel}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MEMORY_LIMIT_MIN}
                    max={MEMORY_LIMIT_MAX}
                    step={1}
                    className={`${CONTROL} w-28`}
                    value={limitText}
                    onChange={(e) => setLimitText(e.target.value)}
                    aria-describedby="memory-limit-help"
                  />
                </label>
                <p id="memory-limit-help" className="pb-3 font-utility text-xs text-[#111827]/65">{c.limitHelp}</p>
              </div>
              <p className="mt-3 font-utility text-xs text-[#111827]/65" aria-live="polite">
                {fmt(c.countLine, { shown: data.memories.length, total: data.memory_count })}
                {isFetching && ' …'}
              </p>
              {data.memories.length === 0 ? (
                <p className="mt-2 font-utility text-sm text-[#111827]/65">{c.empty}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.memories.map((m) => <MemoryRow key={m.id} item={m} copy={copy} />)}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Profile({ profile, copy }: { profile: MemoryProfile | null; copy: StaffLeadsCopy }) {
  const c = copy.memory
  if (!profile) {
    return (
      <div>
        <h3 className="font-utility text-sm font-semibold text-[#091c3c]">{c.profileTitle}</h3>
        <p className="mt-1 font-utility text-sm text-[#111827]/65">{c.noProfile}</p>
      </div>
    )
  }
  return (
    <div>
      <h3 className="font-utility text-sm font-semibold text-[#091c3c]">{c.profileTitle}</h3>
      <dl className="mt-2 space-y-2 font-utility text-sm text-[#111827]">
        <Row label={c.summary}><span className={TEXT}>{profile.summary}</span></Row>
        <Row label={c.traits}><TextList items={profile.traits} none={c.noValue} /></Row>
        <Row label={c.openQuestions}><TextList items={profile.open_questions} none={c.noValue} /></Row>
        <Row label={c.nextBestAction}>
          <span className={TEXT}>{profile.next_best_action ?? c.noValue}</span>
        </Row>
        <Row label={c.lastReflected}>{formatDatetime(profile.last_reflected_at)} IST</Row>
        <Row label={c.reflectionCount}>{profile.reflection_count}</Row>
      </dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-[#111827]/65">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function TextList({ items, none }: { items: string[]; none: string }) {
  if (items.length === 0) return <span>{none}</span>
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((t, i) => <li key={i} className={TEXT}>{t}</li>)}
    </ul>
  )
}

function MemoryRow({ item, copy }: { item: MemoryItem; copy: StaffLeadsCopy }) {
  const c = copy.memory
  const kindLabel = (c.kinds as Record<string, string>)[item.kind] ?? item.kind
  return (
    <li className="rounded-lg border border-[#e4e8ee] p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-utility text-xs text-[#111827]/65">
        <span className="rounded-full bg-[#f7f9fc] px-2 py-0.5 font-semibold text-[#091c3c]">{kindLabel}</span>
        <span>{fmt(c.salience, { value: item.salience })}</span>
        <span>{c.occurred}: {formatDatetime(item.occurred_at)} IST</span>
        <span className={TEXT}>{c.source}: {item.source}</span>
      </div>
      <p className={`mt-1.5 font-utility text-sm text-[#111827] ${TEXT}`}>{item.summary}</p>
      {item.detail && <p className={`mt-1 font-utility text-sm text-[#111827]/75 ${TEXT}`}>{item.detail}</p>}
      {item.tags.length > 0 && (
        <ul aria-label={c.tags} className="mt-1.5 flex flex-wrap gap-1.5">
          {item.tags.map((t, i) => (
            <li key={i} className={`rounded bg-[#f7f9fc] px-1.5 py-0.5 font-utility text-xs text-[#111827]/75 ${TEXT}`}>{t}</li>
          ))}
        </ul>
      )}
    </li>
  )
}
