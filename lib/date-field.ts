// Pure date logic behind components/forms/DateField.tsx: parsing what people
// type or paste, real-calendar checks, ranges and the read-back in words.
// Dates travel as the same `YYYY-MM-DD` strings a native <input type="date">
// produces, so every form and API call stays exactly as it was.

export interface DateParts {
  day: number
  month: number
  year: number
}

export type DateProblem = 'invalid' | 'future' | 'underAge' | 'tooOld' | 'beforeMin' | 'afterMax'

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** A date that exists on the calendar: no 31/04, no 29/02 outside leap years. */
export function isRealDate({ day, month, year }: DateParts): boolean {
  // NaN fails every comparison; parts come from digit strings, so they are whole numbers.
  return year >= 1000 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

export function toIso({ day, month, year }: DateParts): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** `YYYY-MM-DD` → parts, or null when it is not a real date. */
export function fromIso(iso: string | null | undefined): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return null
  const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  return isRealDate(parts) ? parts : null
}

/**
 * What someone pastes or types in one go: `14/06/1995`, `14-06-1995`,
 * `14.06.1995`, `14 06 1995`, `14061995` (day first, the Indian order) or the
 * ISO `1995-06-14`. Returns the parts even when the date itself is not real,
 * so the field can show what was entered and say why it is refused.
 */
export function parseDateText(text: string): DateParts | null {
  const t = text.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
  m = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(t)
  if (m) return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(t)
  if (m) return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }
  return null
}

/** Today on this device, as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return toIso({ day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() })
}

/** The same calendar day `years` later (29 Feb lands on 28 Feb in a common year). */
export function addYears(iso: string, years: number): string {
  const p = fromIso(iso)
  if (!p) return iso
  const year = p.year + years
  return toIso({ year, month: p.month, day: Math.min(p.day, daysInMonth(year, p.month)) })
}

/** The day someone born on `birth` turns `age` — the same rule as isAdult (29 Feb → 1 Mar). */
export function birthdayAt(birth: string, age: number): string {
  const p = fromIso(birth)
  if (!p) return birth
  const d = new Date(p.year + age, p.month - 1, p.day)
  return toIso({ day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() })
}

export interface DateRules {
  /** Earliest allowed date (inclusive). */
  min?: string
  /** Latest allowed date (inclusive). */
  max?: string
  /** Date of birth: not in the future, at least `minAge` years old, at most `maxAge`. */
  dob?: { minAge: number; maxAge: number }
  today?: string
}

/** The effective earliest/latest dates, with date-of-birth limits folded in. */
export function bounds(rules: DateRules): { min?: string; max?: string } {
  if (!rules.dob) return { min: rules.min, max: rules.max }
  const today = rules.today ?? todayIso()
  const oldest = addYears(today, -rules.dob.maxAge)
  const youngest = addYears(today, -rules.dob.minAge)
  return {
    min: rules.min && rules.min > oldest ? rules.min : oldest,
    max: rules.max && rules.max < youngest ? rules.max : youngest,
  }
}

/** Why a complete date is refused, or null when it is fine. */
export function checkDate(parts: DateParts, rules: DateRules = {}): DateProblem | null {
  if (!isRealDate(parts)) return 'invalid'
  const iso = toIso(parts)
  const today = rules.today ?? todayIso()
  if (rules.dob) {
    if (iso > today) return 'future'
    if (birthdayAt(iso, rules.dob.minAge) > today) return 'underAge'
    if (iso < addYears(today, -rules.dob.maxAge)) return 'tooOld'
  }
  if (rules.min && iso < rules.min) return 'beforeMin'
  if (rules.max && iso > rules.max) return 'afterMax'
  return null
}

const INTL_LOCALE: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN' }

/** "14 June 1995" in the page's language, so a swapped day and month is obvious. */
export function readBack(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const p = fromIso(iso)
  if (!p) return ''
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? locale, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC', ...opts,
  }).format(Date.UTC(p.year, p.month - 1, p.day))
}

/** Month names for the calendar's month dropdown, in the page's language. */
export function monthNames(locale: string): string[] {
  const f = new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? locale, { month: 'long', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, i) => f.format(Date.UTC(2000, i, 1)))
}

/** Short weekday names, Monday first (the Indian calendar convention). */
export function weekdayNames(locale: string): string[] {
  const f = new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? locale, { weekday: 'narrow', timeZone: 'UTC' })
  // 1 Jan 2001 was a Monday.
  return Array.from({ length: 7 }, (_, i) => f.format(Date.UTC(2001, 0, 1 + i)))
}

/** Monday-first day-of-week index (0 = Monday) of the 1st of the month. */
export function firstWeekday(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7
}

/** Moves a date by whole days / months, clamping the day to the target month. */
export function shiftDays(iso: string, days: number): string {
  const p = fromIso(iso)
  if (!p) return iso
  const d = new Date(p.year, p.month - 1, p.day + days)
  return toIso({ day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() })
}

export function shiftMonths(iso: string, months: number): string {
  const p = fromIso(iso)
  if (!p) return iso
  const index = p.year * 12 + (p.month - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return toIso({ year, month, day: Math.min(p.day, daysInMonth(year, month)) })
}

export function clampIso(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min
  if (max && iso > max) return max
  return iso
}
