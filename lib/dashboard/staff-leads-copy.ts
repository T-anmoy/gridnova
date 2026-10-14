'use client'

// Translated copy for the staff Leads screens. The rest of the dashboard is
// English-only, so there is no locale provider above it: the language is the
// NEXT_LOCALE cookie the site's language switcher already sets. The server
// render and first client render are English (no hydration mismatch); a
// hi/bn reader gets their language right after mount.
import { useEffect, useState } from 'react'
import copy from './staff-leads-copy.generated.json'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n/config'
import { fmt } from '@/lib/i18n/types'

export type StaffLeadsCopy = typeof copy.en
export { fmt }

export function staffLeadsCopyFor(locale: Locale): StaffLeadsCopy {
  return (copy[locale] ?? copy.en) as StaffLeadsCopy
}

export function localeFromCookie(cookie: string): Locale {
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
  const value = match?.slice(LOCALE_COOKIE.length + 1)
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export function useStaffLeadsCopy(): StaffLeadsCopy {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  useEffect(() => {
    // Reading the cookie must wait for the client; this is the one-time sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(localeFromCookie(document.cookie))
  }, [])
  return staffLeadsCopyFor(locale)
}
