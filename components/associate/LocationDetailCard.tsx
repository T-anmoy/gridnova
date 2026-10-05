'use client'

import { ExternalLink, MapPin } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { LocationStateBadge } from '@/components/associate/SiteLocationStep'
import { useMessages } from '@/lib/i18n/client'
import { roundedCoordinates } from '@/lib/associate/site-location'
import type { SiteLocation } from '@/lib/associate/onboarding-types'

/**
 * The house location on a customer's page. The owner sees where it is (and can
 * open it in Google Maps); anyone else — a Preferred Associate looking at a
 * downline customer — sees only whether it was captured and confirmed. The
 * backend withholds the coordinates from them; this card never tries to show
 * or work them out.
 */
export default function LocationDetailCard({
  location,
  isOwner,
  editHref,
}: {
  location: SiteLocation
  isOwner: boolean
  editHref?: string
}) {
  const m = useMessages('siteLocation')
  const linkClass = 'inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#0e2a63] underline'
  return (
    <div className="rounded-2xl border border-[#e4e8ee] bg-white p-5" data-testid="location-detail">
      <p className="flex items-center gap-1.5 font-display text-base font-semibold text-[#0e2a63]">
        <MapPin className="h-4 w-4" aria-hidden="true" /> {m.detail.title}
      </p>
      {isOwner ? (
        <div className="mt-3 space-y-2">
          <LocationStateBadge location={location} />
          {location.latitude != null && location.longitude != null && (
            <p className="font-utility text-sm text-[#111827]/80">{roundedCoordinates(location.latitude, location.longitude)}</p>
          )}
          {location.maps_url && (
            <a href={location.maps_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <ExternalLink className="mr-1.5 h-4 w-4" /> {m.actions.openMaps}
            </a>
          )}
          {editHref && (
            <div>
              <Link href={editHref} className={linkClass}>
                {location.present ? m.actions.change : m.chip.needed}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p data-testid="location-detail-other" className="mt-2 font-utility text-sm text-[#111827]/75">
          {location.confirmed ? m.detail.confirmedOther : location.present ? m.detail.capturedOther : m.detail.notCaptured}
        </p>
      )}
    </div>
  )
}
