'use client'

import { useState } from 'react'
import { Plus, ChevronRight } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { useOnboardings } from '@/lib/associate/onboarding-api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import PinnedAction from '@/components/associate/PinnedAction'
import LocationChip from '@/components/associate/LocationChip'
import EstimatedCommissionNote from '@/components/associate/EstimatedCommissionNote'
import { nextStepKeyFromSummary } from '@/lib/onboarding/progress'
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
  actionNeededLabel,
}: {
  onboarding: Onboarding
  portalBase: '/associates/portal' | '/preferred/portal'
  copy: CustomersCopy
  nextStepCopy: NextStepCopy
  actionNeededLabel: string
}) {
  return (
    <Link
      href={`${portalBase}/customers/${onboarding.onboarding_id}`}
      className="block rounded-2xl border border-[#e4e8ee] bg-white p-5 hover:border-[#2f5daa]/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-[#0e2a63] truncate">{onboarding.customer.name}</p>
          <p className="mt-0.5 text-xs text-[#111827]/65 font-utility">{onboarding.customer.mobile}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onboarding.score && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold font-utility ${BAND_CLASS[onboarding.score.band]}`}>
              {copy.band[onboarding.score.band]}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-[#111827]/65" />
        </div>
      </div>

      <div className="mt-3">
        <LocationChip location={onboarding.site_location} status={onboarding.status} />
      </div>

      <NextStepLine summary={onboarding.progress_summary} blocked={onboarding.formal_proposal_blocked} nextStepCopy={nextStepCopy} actionNeededLabel={actionNeededLabel} />

      <EstimatedCommissionNote value={onboarding.estimated_commission} inLink />
    </Link>
  )
}

// The "what to do next" line comes from the list response's own
// `progress_summary` — one request for the whole page, never one per card.
function NextStepLine({
  summary,
  blocked,
  nextStepCopy,
  actionNeededLabel,
}: {
  summary: Onboarding['progress_summary']
  blocked: Onboarding['formal_proposal_blocked']
  nextStepCopy: NextStepCopy
  actionNeededLabel: string
}) {
  const key = nextStepKeyFromSummary(summary, blocked)
  if (!key) return null
  const text = nextStepCopy[key as keyof NextStepCopy] ?? nextStepCopy.none
  const stalled = key.startsWith('blocked') || key === 'executionRejected'
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {summary?.needs_action && (
        <span data-testid="action-needed" className="rounded-full bg-[#f7a800]/20 px-2.5 py-1 font-utility text-xs font-semibold text-[#7a5200]">
          {actionNeededLabel}
        </span>
      )}
      <p className={`text-xs font-utility ${stalled ? 'text-amber-700' : 'text-[#111827]/65'}`}>{text}</p>
    </div>
  )
}

export default function CustomersList({
  copy,
  nextStepCopy,
  actionNeededLabel,
  portalBase,
}: {
  copy: CustomersCopy
  nextStepCopy: NextStepCopy
  actionNeededLabel: string
  portalBase: '/associates/portal' | '/preferred/portal'
}) {
  const [mineOnly, setMineOnly] = useState(false)
  const { data, isLoading, error, refetch } = useOnboardings({ mine_only: mineOnly, page_size: 50 })

  return (
    <div className="pb-24 sm:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
        <PinnedAction>
          <Link
            href={`${portalBase}/customers/new`}
            className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#0e2a63] px-4 text-sm font-semibold text-white font-utility sm:min-h-[44px] sm:w-auto"
          >
            <Plus className="h-4 w-4" /> {copy.addButton}
          </Link>
        </PinnedAction>
      </div>

      <label className="mt-4 flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4 rounded border-[#e4e8ee]" />
        <span className="text-xs font-utility text-[#111827]/60">{copy.filters.mineOnly}</span>
      </label>

      {error && <DashboardError error={error} onRetry={() => void refetch()} />}

      {isLoading && (
        <div role="status" aria-busy="true" className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#eef1f6]" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-8 text-center">
          <p className="font-display text-lg font-semibold text-[#0e2a63]">{copy.empty.title}</p>
          <p className="mt-2 text-sm text-[#111827]/65 leading-relaxed max-w-md mx-auto">{copy.empty.body}</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-6 space-y-3">
          {data.items.map((o) => (
            <CustomerCard key={o.onboarding_id} onboarding={o} portalBase={portalBase} copy={copy} nextStepCopy={nextStepCopy} actionNeededLabel={actionNeededLabel} />
          ))}
        </div>
      )}
    </div>
  )
}
