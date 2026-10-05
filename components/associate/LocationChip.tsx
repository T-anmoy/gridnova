'use client'

import { CheckCircle2, MapPinOff, MapPin } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import type { OnboardingStatus, SiteLocation } from '@/lib/associate/onboarding-types'

/**
 * A small status chip built only from `present` and `confirmed` — the two
 * fields every viewer (including a Preferred Associate looking at a downline
 * customer) is allowed to see. Customers already past draft are grandfathered
 * without a location, so a missing one is only flagged on drafts.
 */
export default function LocationChip({ location, status }: { location: SiteLocation | undefined; status: OnboardingStatus }) {
  const m = useMessages('siteLocation')
  if (!location) return null
  if (location.confirmed) {
    return (
      <span data-testid="location-chip" data-state="confirmed" className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 font-utility text-xs font-semibold text-green-800">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {m.chip.confirmed}
      </span>
    )
  }
  if (status !== 'draft') return null
  if (location.present) {
    return (
      <span data-testid="location-chip" data-state="to-confirm" className="inline-flex items-center gap-1 rounded-full bg-[#f7a800]/20 px-2.5 py-1 font-utility text-xs font-semibold text-[#7a5200]">
        <MapPin className="h-3 w-3" aria-hidden="true" /> {m.chip.toConfirm}
      </span>
    )
  }
  return (
    <span data-testid="location-chip" data-state="needed" className="inline-flex items-center gap-1 rounded-full bg-[#f7a800]/20 px-2.5 py-1 font-utility text-xs font-semibold text-[#7a5200]">
      <MapPinOff className="h-3 w-3" aria-hidden="true" /> {m.chip.needed}
    </span>
  )
}
