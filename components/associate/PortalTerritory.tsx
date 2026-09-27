import { Clock } from 'lucide-react'
import type { Messages } from '@/lib/i18n/types'

// Deliberately an honest placeholder, not a populated-looking screen — Phase
// 3 hasn't built territory performance, sub-Associate rosters, or territory
// commission yet.
export default function PortalTerritory({ copy }: { copy: Messages['associates']['portal']['preferred']['territory'] }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-8 text-center">
        <Clock className="h-8 w-8 mx-auto text-[#111827]/25" />
        <p className="mt-3 font-display text-lg font-semibold text-[#0e2a63]">{copy.comingSoonTitle}</p>
        <p className="mt-2 text-sm text-[#111827]/55 leading-relaxed max-w-md mx-auto">{copy.comingSoonBody}</p>
      </div>
    </div>
  )
}
