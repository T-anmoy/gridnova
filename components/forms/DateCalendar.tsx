'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Messages } from '@/lib/i18n/types'
import {
  clampIso, daysInMonth, firstWeekday, fromIso, monthNames, readBack, shiftDays, shiftMonths, toIso, todayIso, weekdayNames,
} from '@/lib/date-field'

// The calendar half of DateField, loaded only when opened. Month and year are
// dropdowns, so a birth year decades back is two choices, not hundreds of
// "previous month" clicks. The day grid follows the WAI-ARIA date picker
// pattern: one tab stop, arrow keys move by day/week, Page Up/Down by month
// (with Shift by year), Home/End to the week's ends, Enter picks, Escape closes.

// Wide enough for 44 px day buttons on a 360 px phone (7 × 44 + padding).
const POPOVER_WIDTH = 336
const GUTTER = 8

export default function DateCalendar({
  anchor, value, openAt, min, max, locale, t, onSelect, onClose,
}: {
  anchor: RefObject<HTMLDivElement | null>
  value: string
  openAt: string
  min?: string
  max?: string
  locale: string
  t: Messages['dateField']
  onSelect: (iso: string) => void
  onClose: () => void
}) {
  const today = todayIso()
  const [focused, setFocused] = useState(() => clampIso(openAt, min, max))
  const popRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLTableElement>(null)
  const moved = useRef(false)
  const f = fromIso(focused)!

  // Keep the popover on screen: start under the field, shift left when it would run off the right edge.
  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r || !popRef.current) return
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - GUTTER * 2)
    const x = Math.max(GUTTER, Math.min(r.left, window.innerWidth - GUTTER - width))
    popRef.current.style.left = `${x - r.left}px`
    // Bring the whole calendar on screen when it opens near the bottom.
    popRef.current.scrollIntoView?.({ block: 'nearest' })
  }, [anchor])

  // Focus the active day when the calendar opens and whenever the keyboard moves it.
  useEffect(() => {
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${focused}"]`)
    if (btn && (moved.current || !document.activeElement?.closest('[data-date-calendar]'))) btn.focus()
    moved.current = false
  }, [focused])

  const minYear = fromIso(min)?.year ?? fromIso(today)!.year - 100
  const maxYear = fromIso(max)?.year ?? fromIso(today)!.year + 10
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)
  const months = monthNames(locale)
  const outOfRange = (iso: string) => (!!min && iso < min) || (!!max && iso > max)

  const go = (iso: string, fromKeyboard = true) => {
    moved.current = fromKeyboard
    setFocused(clampIso(iso, min, max))
  }
  const setMonthYear = (year: number, month: number) =>
    go(clampIso(toIso({ year, month, day: Math.min(f.day, daysInMonth(year, month)) }), min, max), false)

  function onGridKey(e: KeyboardEvent<HTMLTableElement>) {
    const dow = (firstWeekday(f.year, f.month) + f.day - 1) % 7
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftDays(focused, -1),
      ArrowRight: () => shiftDays(focused, 1),
      ArrowUp: () => shiftDays(focused, -7),
      ArrowDown: () => shiftDays(focused, 7),
      Home: () => shiftDays(focused, -dow),
      End: () => shiftDays(focused, 6 - dow),
      PageUp: () => shiftMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => shiftMonths(focused, e.shiftKey ? 12 : 1),
    }
    if (moves[e.key]) {
      e.preventDefault()
      go(moves[e.key]())
    }
  }

  // Monday-first weeks for the visible month, with blanks before the 1st.
  const lead = firstWeekday(f.year, f.month)
  const total = daysInMonth(f.year, f.month)
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  const prevMonth = shiftMonths(toIso({ ...f, day: 1 }), -1)
  const nextMonth = shiftMonths(toIso({ ...f, day: 1 }), 1)
  const canPrev = !min || toIso({ ...fromIso(prevMonth)!, day: daysInMonth(fromIso(prevMonth)!.year, fromIso(prevMonth)!.month) }) >= min
  const canNext = !max || nextMonth <= max

  const selectClass = 'min-h-11 md:min-h-9 rounded-lg border border-[#e4e8ee] bg-white px-2 text-sm font-utility text-[#111827] focus-visible:outline-2 focus-visible:outline-[#2f5daa]'
  const navClass = 'flex h-11 w-11 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-lg text-[#0e2a63] hover:bg-[#2f5daa]/10 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[#2f5daa]'

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-modal="false"
      aria-label={t.calendarLabel}
      data-date-calendar
      // A press on the calendar's own padding or labels must not take focus out of the
      // field (DateField closes the calendar when focus leaves it).
      onMouseDown={(e) => {
        if (!(e.target as Element).closest('button, select')) e.preventDefault()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
      }}
      style={{ left: 0, width: `min(${POPOVER_WIDTH}px, calc(100vw - ${GUTTER * 2}px))` }}
      className="absolute top-full z-[210] mt-1 rounded-2xl border border-[#e4e8ee] bg-white p-2 shadow-[0_16px_40px_-12px_rgba(9,28,60,0.35)]"
    >
      <div className="flex items-center gap-1">
        <button type="button" className={navClass} aria-label={t.previousMonth} disabled={!canPrev} onClick={() => go(shiftMonths(focused, -1), false)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <select aria-label={t.monthSelect} className={`${selectClass} min-w-0 flex-1`} value={f.month} onChange={(e) => setMonthYear(f.year, Number(e.target.value))}>
          {months.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select aria-label={t.yearSelect} className={selectClass} value={f.year} onChange={(e) => setMonthYear(Number(e.target.value), f.month)}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="button" className={navClass} aria-label={t.nextMonth} disabled={!canNext} onClick={() => go(shiftMonths(focused, 1), false)}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <table ref={gridRef} role="grid" aria-label={`${months[f.month - 1]} ${f.year}`} onKeyDown={onGridKey} className="mt-2 w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            {weekdayNames(locale).map((d, i) => (
              <th key={i} scope="col" className="pb-1 text-[11px] font-utility font-normal text-[#111827]/60">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, i) => {
                if (!day) return <td key={i} />
                const iso = toIso({ ...f, day })
                const disabled = outOfRange(iso)
                const selected = iso === value
                const isToday = iso === today
                return (
                  <td key={i} className="p-0">
                    <button
                      type="button"
                      data-iso={iso}
                      tabIndex={iso === focused ? 0 : -1}
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={readBack(iso, locale, { weekday: 'long' })}
                      onClick={() => onSelect(iso)}
                      onFocus={() => iso !== focused && setFocused(iso)}
                      className={`h-11 w-full rounded-lg text-sm font-utility tabular-nums transition-colors focus:outline-2 focus:outline-offset-[-2px] focus:outline-[#2f5daa] disabled:cursor-not-allowed disabled:text-[#111827]/25 ${
                        selected ? 'bg-[#0e2a63] text-white' : isToday ? 'ring-1 ring-inset ring-[#f7a800] text-[#0e2a63] font-semibold hover:bg-[#2f5daa]/10' : 'text-[#111827] hover:bg-[#2f5daa]/10'
                      }`}
                    >
                      {day}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={outOfRange(today)}
          onClick={() => onSelect(today)}
          className="min-h-11 md:min-h-9 rounded-lg px-3 text-sm font-utility font-semibold text-[#2f5daa] hover:bg-[#2f5daa]/10 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[#2f5daa]"
        >
          {t.today}
        </button>
      </div>
    </div>
  )
}
