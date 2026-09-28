'use client'

import { useState } from 'react'
import { Loader2, Plus, ChevronRight } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useOnboardings, useOnboardingProgress } from '@/lib/associate/onboarding-api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { getNextStepKey } from '@/lib/onboarding/progress'
import type { Onboarding } from '@/lib/associate/onboarding-types'
import type { Messages } from '@/lib/i18n/types'

type CustomersCopy = Messages['associates']['portal']['customers']
type NextStepCopy = Messages['associates']['portal']['shared']['nextStep']

const BAND_CLASS: Record<'hot' | 'warm' | 'cold', string> = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-amber-100 text-amber-700',
  cold: 'bg-blue-100 text-blue-700',
}

function CustomerCard({
  onboarding,
  portalBase,
  copy,
  nextStepCopy,
}: {
  onboarding: Onboarding
  portalBase: '/associates/portal' | '/preferred/portal'
  copy: CustomersCopy
  nextStepCopy: NextStepCopy
}) {
  return (
    <Link
      href={`${portalBase}/customers/${onboarding.onboarding_id}`}
      className="block rounded-2xl border border-[#e4e8ee] bg-white p-5 hover:border-[#2f5daa]/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-[#0e2a63] truncate">{onboarding.customer.name}</p>
          <p className="mt-0.5 text-xs text-[#111827]/50 font-utility">{onboarding.customer.mobile}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onboarding.score && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold font-utility ${BAND_CLASS[onboarding.score.band]}`}>
              {copy.band[onboarding.score.band]}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-[#111827]/30" />
        </div>
      </div>

      <NextStepLine onboardingId={onboarding.onboarding_id} blocked={onboarding.formal_proposal_blocked} nextStepCopy={nextStepCopy} />
    </Link>
  )
}

// A separate component so its progress fetch is scoped per card and cached
// by React Query — the list endpoint doesn't include next_stage itself
// (only GET /{id}/progress does), and the brief requires the card's "what
// to do next" prompt to be derived from that real next_stage, not guessed.
function NextStepLine({
  onboardingId,
  blocked,
  nextStepCopy,
}: {
  onboardingId: number
  blocked: Onboarding['formal_proposal_blocked']
  nextStepCopy: NextStepCopy
}) {
  const { data: progress } = useOnboardingProgress(onboardingId)
  if (blocked) {
    return (
      <p className="mt-3 text-xs font-utility text-amber-700">
        {nextStepCopy[blocked.reason === 'draft_failed' ? 'blockedDraftFailed' : 'blockedMissingInformation']}
      </p>
    )
  }
  if (!progress) return null
  const key = getNextStepKey(progress, blocked)
  return <p className="mt-3 text-xs font-utility text-[#111827]/55">{nextStepCopy[key as keyof NextStepCopy] ?? nextStepCopy.none}</p>
}

export default function CustomersList({
  copy,
  nextStepCopy,
  portalBase,
}: {
  copy: CustomersCopy
  nextStepCopy: NextStepCopy
  portalBase: '/associates/portal' | '/preferred/portal'
}) {
  const [mineOnly, setMineOnly] = useState(false)
  const { data, isLoading, error, refetch } = useOnboardings({ mine_only: mineOnly, page_size: 50 })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
        <Link
          href={`${portalBase}/customers/new`}
          className="flex items-center gap-1.5 rounded-lg bg-[#0e2a63] px-4 py-2.5 text-sm font-semibold text-white font-utility"
        >
          <Plus className="h-4 w-4" /> {copy.addButton}
        </Link>
      </div>

      <label className="mt-4 flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4 rounded border-[#e4e8ee]" />
        <span className="text-xs font-utility text-[#111827]/60">{copy.filters.mineOnly}</span>
      </label>

      {error && <DashboardError error={error} onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#111827]/30" />
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-8 text-center">
          <p className="font-display text-lg font-semibold text-[#0e2a63]">{copy.empty.title}</p>
          <p className="mt-2 text-sm text-[#111827]/55 leading-relaxed max-w-md mx-auto">{copy.empty.body}</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-6 space-y-3">
          {data.items.map((o) => (
            <CustomerCard key={o.onboarding_id} onboarding={o} portalBase={portalBase} copy={copy} nextStepCopy={nextStepCopy} />
          ))}
        </div>
      )}
    </div>
  )
}
