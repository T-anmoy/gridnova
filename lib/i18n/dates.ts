// Dates in the reader's language: "12 अक्टू॰ 2026", "12 অক্টো, 2026". Always in
// India time, and always with Latin digits — the same digits as amounts,
// references and phone numbers on the page (Bengali's default would switch to
// Bengali digits for dates only).
import { useMemo } from 'react'
import { useLocale } from './client'
import type { Locale } from './config'

const INTL_LOCALE: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN' }
const IST = 'Asia/Kolkata'

function format(locale: Locale, iso: string | null | undefined, withTime: boolean): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: IST,
    numberingSystem: 'latn',
  }).format(date)
}

export function formatDateFor(locale: Locale, iso: string | null | undefined): string {
  return format(locale, iso, false)
}

export function formatDatetimeFor(locale: Locale, iso: string | null | undefined): string {
  return format(locale, iso, true)
}

/** `formatDate` / `formatDatetime` for the page's language (English outside any provider). */
export function useDates() {
  const locale = useLocale()
  return useMemo(
    () => ({
      formatDate: (iso: string | null | undefined) => formatDateFor(locale, iso),
      formatDatetime: (iso: string | null | undefined) => formatDatetimeFor(locale, iso),
    }),
    [locale]
  )
}
