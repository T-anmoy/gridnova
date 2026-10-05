'use client'

import { ClipboardPaste, Map, MapPin, Share2, X } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'

// Four plain steps with simple icons — no map screenshots, no Google artwork.
const ICONS = [Map, MapPin, Share2, ClipboardPaste]

export default function MapsHelpSheet({ onClose }: { onClose: () => void }) {
  const m = useMessages('siteLocation')
  return (
    <section aria-label={m.help.title} data-testid="maps-help" className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-[#0e2a63]">{m.help.title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={m.help.close}
          className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#111827]/60"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <ol className="mt-3 space-y-3">
        {m.help.steps.map((step, i) => {
          const Icon = ICONS[i] ?? Map
          return (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0e2a63] text-white" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-utility text-sm font-semibold text-[#0e2a63]">
                  {i + 1}. {step.title}
                </p>
                <p className="mt-0.5 font-utility text-sm text-[#111827]/70">{step.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
