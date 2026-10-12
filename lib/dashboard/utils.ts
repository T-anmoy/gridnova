import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  // Indian numbering: format as INR X,XX,XXX
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
  return formatted
}

// Every timestamp on this dashboard is displayed as real IST, explicitly —
// never the viewer's browser-local timezone. `Intl.DateTimeFormat`'s locale
// ('en-IN') only controls formatting style (day/month order, "Sept" vs
// "September"); it does NOT pin the timezone — omitting `timeZone` silently
// falls back to the browser's own zone, which only happens to look right for
// a viewer already set to IST. A staff member anywhere else previously saw a
// materially different (and wrong) time for the same real event. This is the
// one place that conversion happens, so every call site gets it for free.
export const IST_TIME_ZONE = 'Asia/Kolkata'

/** The IST calendar day (YYYY-MM-DD) of an instant — never the browser's own zone. */
export function istDateKey(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: IST_TIME_ZONE,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return formatDate(iso)
  } catch {
    return iso
  }
}

export function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: IST_TIME_ZONE,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// "Monday, 8 September 2026" in real IST — for the dashboard's own
// current-date greeting banner, which previously read the browser's local
// calendar date directly (wrong near a day boundary for any non-IST viewer).
export function formatLongDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: IST_TIME_ZONE,
  }).format(date)
}

// The current hour (0-23) in real IST — for time-of-day greeting logic
// ("Good morning/afternoon/evening"), which previously used the browser's
// local hour directly (greeting a Grid Nova staff member logged in from
// outside India at the wrong time of their actual IST business day).
export function getISTHour(date: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: IST_TIME_ZONE,
  }).format(date)
  // en-US hour12:false can render midnight as "24" instead of "0".
  return Number(hourStr) % 24
}
