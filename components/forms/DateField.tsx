'use client'

import { Fragment, Suspense, lazy, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useLocale, useMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import {
  addYears, bounds, checkDate, daysInMonth, fromIso, parseDateText, readBack, toIso, todayIso, type DateRules,
} from '@/lib/date-field'

// The calendar is only downloaded when someone opens it, so typing a date costs
// a page none of its code.
const DateCalendar = lazy(() => import('./DateCalendar'))

/**
 * One date field for the whole app: type `DD / MM / YYYY` (digits only, the
 * cursor moves on by itself, paste any common format) or pick from a calendar
 * with month and year dropdowns. Emits the same `YYYY-MM-DD` string a native
 * date input does, and '' while the date is incomplete or does not exist, so
 * forms and API calls are unchanged.
 *
 * Controlled (`value` + `onChange`) or uncontrolled inside a <form> (`name` +
 * `defaultValue`, posted through a hidden input). `id`, `aria-invalid` and
 * `aria-describedby` go on the day segment, so a wrapping Field's label and
 * error wiring keep working.
 */
export interface DateFieldProps {
  id?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  name?: string
  /**
   * The field's name. With an `id` (a visible <label htmlFor> names the day box)
   * it only qualifies the other segments ("Starts on, month"); without one it
   * also names the group.
   */
  label?: string
  /** Date of birth: not in the future, at least `minAge` (default 18) and at most 100 years old. */
  mode?: 'date' | 'dob'
  minAge?: number
  min?: string
  max?: string
  /**
   * `site` matches the public and portal forms and shows the date in words under the field;
   * `dashboard` the staff screens' compact inputs, with only problems shown under them.
   */
  variant?: 'site' | 'dashboard'
  disabled?: boolean
  required?: boolean
  className?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
}

// Segments are kept as [day, month, year] strings; LEN is each one's digit count.
type Segs = [string, string, string]
const SEG = ['day', 'month', 'year'] as const
const LEN = [2, 2, 4]
const DOB_MAX_AGE = 100
const DOB_OPEN_AGE = 30

const pad = (s: string) => (s.length === 1 ? `0${s}` : s)

function segsFrom(iso: string | undefined): Segs {
  const p = fromIso(iso)
  return p ? [pad(String(p.day)), pad(String(p.month)), String(p.year)] : ['', '', '']
}

const partsOf = (s: Segs) => (s[0] && s[1] && s[2].length === 4 ? { day: +s[0], month: +s[1], year: +s[2] } : null)

export default function DateField({
  id, value, defaultValue, onChange, name, label, mode = 'date', minAge = 18, min, max,
  variant = 'site', disabled, required, className, ...aria
}: DateFieldProps) {
  const locale = useLocale()
  // Provided by the portal/booking layouts in the page's language and by the dashboard layout (staff copy).
  const t = useMessages('dateField')
  const auto = useId()
  const baseId = id ?? `${auto}d`
  const statusId = `${auto}s`
  const controlled = value !== undefined
  const initial = controlled ? value : defaultValue
  const [segs, setSegs] = useState(() => segsFrom(initial))
  const [touched, setTouched] = useState(false)
  const [open, setOpen] = useState(false)
  const emitted = useRef(fromIso(initial) ? initial! : '')
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const rules: DateRules = { min, max, dob: mode === 'dob' ? { minAge, maxAge: DOB_MAX_AGE } : undefined }
  const range = bounds(rules)

  // A new value from outside (a restored draft, a reset filter) replaces what is typed;
  // our own '' for a half-typed date does not.
  useEffect(() => {
    if (!controlled || value === emitted.current) return
    emitted.current = value
    setSegs(segsFrom(value))
  }, [controlled, value])

  const parts = partsOf(segs)
  const problem = parts && checkDate(parts, rules)
  const iso = parts && problem !== 'invalid' ? toIso(parts) : ''

  function commit(next: Segs) {
    setSegs(next)
    const p = partsOf(next)
    const out = p && checkDate(p, rules) !== 'invalid' ? toIso(p) : ''
    if (out !== emitted.current) {
      emitted.current = out
      onChange?.(out)
    }
  }

  function focus(i: number, end = true) {
    const el = inputs.current[i]
    if (!el) return
    el.focus()
    const at = end ? el.value.length : 0
    el.setSelectionRange(at, at)
  }

  function type(i: number, raw: string) {
    const next = [...segs] as Segs
    let rest = raw.replace(/\D/g, '')
    let j = i
    // Digits beyond the segment (a fast keyboard, an Android IME, autofill) flow into the next ones.
    for (; j < 2; j++) {
      next[j] = rest.slice(0, LEN[j])
      rest = rest.slice(LEN[j])
      if (!rest) break
    }
    if (j === 2) next[2] = rest.slice(0, 4)
    // A full segment moves on, and so does a first digit no second digit could follow (4 → 04).
    if (j < 2 && next[j].length === 1 && +next[j] > (j ? 1 : 3)) next[j] = pad(next[j])
    commit(next)
    if (j < 2 && next[j].length === 2) focus(j + 1, false)
    else if (j !== i) focus(j)
  }

  function step(i: number, by: number) {
    const now = fromIso(todayIso())!
    const cur = +segs[i]
    const top = i ? 12 : +segs[2] && +segs[1] ? daysInMonth(+segs[2], +segs[1]) : 31
    const n = !cur
      ? [now.day, now.month, now.year - (mode === 'dob' ? DOB_OPEN_AGE : 0)][i]
      : i === 2 ? cur + by : ((cur - 1 + by + top) % top) + 1
    const next = [...segs] as Segs
    next[i] = i === 2 ? String(n) : pad(String(n))
    commit(next)
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget
    const k = e.key
    let handled = true
    // Up/Down step the value; Tab and Shift+Tab move between segments.
    if (k === 'ArrowUp' || k === 'ArrowDown') step(i, k === 'ArrowUp' ? 1 : -1)
    else if (k === 'Backspace' && i && !el.value) {
      const next = [...segs] as Segs
      next[i - 1] = next[i - 1].slice(0, -1)
      commit(next)
      focus(i - 1)
    } else if (k.length === 1 && '/-. '.includes(k)) {
      // Typing the separator moves on, padding a lone digit (1/ → 01).
      if (segs[i] && i < 2) {
        const next = [...segs] as Segs
        next[i] = pad(segs[i])
        commit(next)
        focus(i + 1, false)
      }
    } else handled = k.length === 1 && !/\d/.test(k) && !e.ctrlKey && !e.metaKey
    if (handled) e.preventDefault()
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const p = parseDateText(e.clipboardData.getData('text'))
    if (!p) return
    e.preventDefault()
    commit([pad(String(p.day)), pad(String(p.month)), String(p.year)])
    setTouched(true)
    focus(2)
  }

  // Leaving the whole field (not moving between its segments or into the calendar) closes the
  // calendar — this is also how a press outside closes it — and points out a half-typed date.
  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (wrapRef.current?.contains(e.relatedTarget as Node | null)) return
    setOpen(false)
    setTouched(true)
    if (segs[0].length === 1 || segs[1].length === 1) commit([pad(segs[0]), pad(segs[1]), segs[2]])
  }

  const limit = problem === 'beforeMin' ? range.min : range.max
  const message = problem
    ? fmt(t[problem], { age: minAge, years: DOB_MAX_AGE, date: limit ? readBack(limit, locale) : '' })
    : touched && !parts && segs.join('') ? t.incomplete : ''
  const words = iso && !problem ? readBack(iso, locale) : ''
  const shown = message || (variant === 'site' && words)
  const invalid = !!message || aria['aria-invalid'] === true || aria['aria-invalid'] === 'true'
  const describedBy = [aria['aria-describedby'], shown ? statusId : null].filter(Boolean).join(' ') || undefined
  // Where the calendar opens when the field is empty: a sensible birth year for a date of birth.
  const openAt = iso || (mode === 'dob' ? addYears(todayIso(), -DOB_OPEN_AGE) : todayIso())
  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  // The look is in globals.css (.df-*), so the JavaScript stays small.
  return (
    <div ref={wrapRef} className={`df ${className ?? ''}`} data-variant={variant} onBlur={onBlur}>
      {/* The calendar anchors to this box, so it opens right under the field, above any message. */}
      <div ref={anchorRef} className="df-anchor">
        <div
          role="group"
          aria-label={id ? undefined : label}
          data-min={range.min}
          data-max={range.max}
          data-value={iso}
          data-invalid={invalid || undefined}
          className="df-box"
        >
          {SEG.map((seg, i) => (
            <Fragment key={seg}>
              {i > 0 && <span aria-hidden="true" className="df-sep">/</span>}
              <input
                ref={(el) => { inputs.current[i] = el }}
                id={i ? `${baseId}-${seg}` : baseId}
                data-seg={seg}
                className="df-seg"
                type="text"
                inputMode="numeric"
                autoComplete={mode === 'dob' ? `bday-${seg}` : 'off'}
                aria-label={!i && id ? undefined : label ? `${label}, ${t[seg].toLowerCase()}` : t[seg]}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                aria-required={required || undefined}
                placeholder={t[`${seg}Placeholder`]}
                value={segs[i]}
                disabled={disabled}
                onChange={(e) => type(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={onPaste}
                onFocus={(e) => e.currentTarget.select()}
              />
            </Fragment>
          ))}
          <button
            ref={buttonRef}
            type="button"
            className="df-btn"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t.closeCalendar : t.openCalendar}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <span aria-hidden="true" className="df-icon" />
          </button>
        </div>
        {open && (
          <Suspense fallback={null}>
            <DateCalendar
              anchor={anchorRef}
              value={iso}
              openAt={openAt}
              min={range.min}
              max={range.max}
              locale={locale}
              t={t}
              onSelect={(picked) => {
                commit(segsFrom(picked))
                setTouched(true)
                close()
              }}
              onClose={close}
            />
          </Suspense>
        )}
      </div>
      {name && <input type="hidden" name={name} value={iso} />}
      {shown && (
        <p id={statusId} aria-live="polite" className="df-status" data-error={message ? '' : undefined}>
          {message || <><span className="sr-only">{t.readBackLabel}: </span>{words}</>}
        </p>
      )}
    </div>
  )
}
