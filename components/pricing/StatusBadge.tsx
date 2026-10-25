'use client'

import { BadgeCheck, CircleDashed, Megaphone } from 'lucide-react'
import { useLocale, useMessages } from '@/lib/i18n/client'
import { LOCALE_META } from '@/lib/i18n/config'
import type { FigureStatus } from '@/lib/pricing/solar-estimate'

// The status of a figure (docs/api/solar_estimate.md §1), in words: an
// announced amount always says it is subject to the official order.

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'border-[#2f5daa]/30 bg-[#2f5daa]/10 text-[#0e2a63]',
  announced: 'border-[#f7a800]/50 bg-[#fffaf0] text-[#7a5200]',
}

export function StatusBadge({ status }: { status: FigureStatus }) {
  const b = useMessages('pricing').estimate.badge
  const label = (b as Record<string, string>)[status] ?? b.other
  const Icon = status === 'confirmed' ? BadgeCheck : status === 'announced' ? Megaphone : CircleDashed
  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-utility text-[11px] font-semibold leading-tight ${STATUS_STYLE[status] ?? 'border-[#e4e8ee] bg-[#f7f9fc] text-[#111827]/70'}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}

/** "2027-08-13" → "13 Aug 2027" in the visitor's language. */
export function useIsoDate() {
  const locale = useLocale()
  return (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
    try {
      return new Intl.DateTimeFormat(LOCALE_META[locale].hreflang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${iso}T00:00:00Z`)
      )
    } catch {
      return iso
    }
  }
}
