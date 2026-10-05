'use client'

import { Camera } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'

// Shown at the top of both the "At the house" and the photos step: the camera
// is the preferred way in, because every camera photo carries the house's
// location. The gallery line is deliberately smaller and quieter.
export default function PhotosFirstCard() {
  const m = useMessages('siteLocation')
  return (
    <div data-testid="photos-first-card" className="rounded-xl border-2 border-[#0e2a63] bg-[#0e2a63]/5 p-4">
      <div className="flex items-start gap-3">
        <Camera className="mt-0.5 h-5 w-5 shrink-0 text-[#0e2a63]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-[#0e2a63]">{m.priority.title}</p>
          <p className="mt-1 font-utility text-sm text-[#111827]/75">{m.priority.body}</p>
        </div>
      </div>
      <p className="mt-3 font-utility text-xs text-[#111827]/55">{m.priority.galleryLine}</p>
    </div>
  )
}
