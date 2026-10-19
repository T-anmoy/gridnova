'use client'

import { useId, useState } from 'react'
import { ChevronDown, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LEAD_STAGES, SCORE_ORDER, type LeadFilters } from '@/lib/dashboard/staff-leads-types'
import {
  activeFilterCount, filterFieldGroup, validateFilters, type FilterApiError,
} from '@/lib/dashboard/lead-filters'
import { fmt, type StaffLeadsCopy } from '@/lib/dashboard/staff-leads-copy'
import type { PipelineStage } from '@/lib/dashboard/types'

const CONTROL =
  'min-h-11 w-full rounded-lg border border-[#e4e8ee] bg-white px-3 text-base md:text-sm font-utility text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800]'

/**
 * Stage multi-select, score range and created-date range. Native checkboxes,
 * selects and date inputs keep it keyboard- and screen-reader-operable. Under
 * md the panel collapses behind a button (an accordion); from md up it is
 * always shown. Messages for a bad range come from the client guard first and
 * from the server's structured 422 code otherwise, both translated by code.
 */
export function LeadFilterPanel({
  filters, onChange, onClear, showClear, serverError, copy,
}: {
  filters: LeadFilters
  onChange: (next: LeadFilters) => void
  onClear: () => void
  /** True when any list filter (this panel's or the search/source/assignment ones) is set. */
  showClear: boolean
  serverError: FilterApiError | null
  copy: StaffLeadsCopy
}) {
  const c = copy.filters
  const panelId = useId()
  const count = activeFilterCount(filters)
  const [open, setOpen] = useState(count > 0)

  const guard = validateFilters(filters)
  const messages: Record<'stage' | 'score' | 'date', string[]> = { stage: [], score: [], date: [] }
  for (const g of guard) messages[filterFieldGroup(g.field) ?? 'score'].push(c.errors[g.code])
  if (serverError) {
    const group = filterFieldGroup(serverError.field)
    const text = c.errors[serverError.code]
    if (group && !messages[group].includes(text)) messages[group].push(text)
  }

  function toggleStage(stage: PipelineStage, checked: boolean) {
    const next = checked ? [...filters.stages, stage] : filters.stages.filter((s) => s !== stage)
    onChange({ ...filters, stages: LEAD_STAGES.filter((s) => next.includes(s)) })
  }

  return (
    <section aria-label={c.heading} className="rounded-xl border border-[#e4e8ee] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#111827]/65" aria-hidden="true" />
          <h2 className="font-utility text-sm font-semibold text-[#091c3c]">{c.heading}</h2>
          {count > 0 && (
            <span className="rounded-full bg-[#f7a800]/15 px-2 py-0.5 font-utility text-xs text-[#091c3c]">
              {fmt(c.activeCount, { count })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showClear && (
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClear}>
              {c.clear}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 md:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? c.hide : c.show}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div id={panelId} className={`${open ? 'block' : 'hidden'} mt-4 md:block`}>
        <div className="grid gap-5 md:grid-cols-3">
          <fieldset aria-describedby={`${panelId}-stage-hint`}>
            <legend className="font-utility text-sm font-medium text-[#091c3c]">{c.stage}</legend>
            <p id={`${panelId}-stage-hint`} className="mt-0.5 font-utility text-xs text-[#111827]/65">{c.stageHint}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3">
              {LEAD_STAGES.map((stage) => (
                <label key={stage} className="flex min-h-11 cursor-pointer items-center gap-2 font-utility text-sm text-[#111827]">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#f7a800]"
                    checked={filters.stages.includes(stage)}
                    onChange={(e) => toggleStage(stage, e.target.checked)}
                  />
                  {c.stages[stage]}
                </label>
              ))}
            </div>
            <FieldMessages id={`${panelId}-stage-err`} messages={messages.stage} />
          </fieldset>

          <fieldset aria-describedby={`${panelId}-score-help`}>
            <legend className="font-utility text-sm font-medium text-[#091c3c]">{c.score}</legend>
            <div className="mt-2 grid gap-3">
              <label className="grid gap-1 font-utility text-sm text-[#111827]">
                {c.minScore}
                <select
                  className={CONTROL}
                  value={filters.minScore}
                  aria-invalid={messages.score.length > 0}
                  onChange={(e) => onChange({ ...filters, minScore: e.target.value as LeadFilters['minScore'] })}
                >
                  <option value="">{c.anyScore}</option>
                  {SCORE_ORDER.map((s) => <option key={s} value={s}>{c.scores[s]}</option>)}
                </select>
              </label>
              <label className="grid gap-1 font-utility text-sm text-[#111827]">
                {c.maxScore}
                <select
                  className={CONTROL}
                  value={filters.maxScore}
                  aria-invalid={messages.score.length > 0}
                  onChange={(e) => onChange({ ...filters, maxScore: e.target.value as LeadFilters['maxScore'] })}
                >
                  <option value="">{c.anyScore}</option>
                  {SCORE_ORDER.map((s) => <option key={s} value={s}>{c.scores[s]}</option>)}
                </select>
              </label>
            </div>
            <p id={`${panelId}-score-help`} className="mt-2 font-utility text-xs text-[#111827]/65">{c.scoreHelp}</p>
            <FieldMessages id={`${panelId}-score-err`} messages={messages.score} />
          </fieldset>

          <fieldset aria-describedby={`${panelId}-date-help`}>
            <legend className="font-utility text-sm font-medium text-[#091c3c]">{c.created}</legend>
            <div className="mt-2 grid gap-3">
              <label className="grid gap-1 font-utility text-sm text-[#111827]">
                {c.createdFrom}
                <input
                  type="date"
                  className={CONTROL}
                  value={filters.createdFrom}
                  aria-invalid={messages.date.length > 0}
                  onChange={(e) => onChange({ ...filters, createdFrom: e.target.value })}
                />
              </label>
              <label className="grid gap-1 font-utility text-sm text-[#111827]">
                {c.createdTo}
                <input
                  type="date"
                  className={CONTROL}
                  value={filters.createdTo}
                  aria-invalid={messages.date.length > 0}
                  onChange={(e) => onChange({ ...filters, createdTo: e.target.value })}
                />
              </label>
            </div>
            <p id={`${panelId}-date-help`} className="mt-2 font-utility text-xs text-[#111827]/65">{c.dateHelp}</p>
            <FieldMessages id={`${panelId}-date-err`} messages={messages.date} />
          </fieldset>
        </div>
      </div>
    </section>
  )
}

function FieldMessages({ id, messages }: { id: string; messages: string[] }) {
  // The live region stays mounted so a screen reader announces a message when it appears.
  return (
    <div id={id} role="alert" aria-live="polite">
      {messages.map((m) => (
        <p key={m} className="mt-2 font-utility text-xs text-red-700">{m}</p>
      ))}
    </div>
  )
}
