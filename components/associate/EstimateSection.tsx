'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useCreateEstimate, useOnboardingEstimates } from '@/lib/associate/onboarding-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatCurrency } from '@/lib/dashboard/utils'
import type { AccessDifficulty, Estimate } from '@/lib/associate/onboarding-types'
import type { Messages } from '@/lib/i18n/types'

type EstimateCopy = Messages['associates']['portal']['estimate']

function EstimateCard({ estimate, copy }: { estimate: Estimate; copy: EstimateCopy }) {
  const r = estimate.result
  return (
    <div className="rounded-xl border border-[#e4e8ee] bg-white p-5">
      {/* Impossible-to-miss banner — this is an estimate, never the formal
          priced proposal. */}
      <div className="rounded-lg bg-[#0e2a63] px-3 py-2">
        <p className="text-xs font-semibold text-white font-utility uppercase tracking-wide">{copy.banner}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[#111827]/50 font-utility">{copy.result.systemSizeLabel}</p>
          <p className="mt-1 font-display text-lg font-semibold text-[#0e2a63]">{r.recommended_size_kw} kW</p>
        </div>
        <div>
          <p className="text-xs text-[#111827]/50 font-utility">{copy.result.subsidyLabel}</p>
          <p className="mt-1 font-display text-lg font-semibold text-[#0e2a63]">{formatCurrency(r.subsidy_inr)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-[#111827]/50 font-utility">{copy.result.netCostLabel}</p>
          {r.is_indicative_range ? (
            <>
              <p className="mt-1 font-display text-xl font-bold text-[#0e2a63]">
                {formatCurrency(r.net_cost_range_min)} – {formatCurrency(r.net_cost_range_max)}
              </p>
              <p className="mt-1 text-xs text-[#111827]/50">{copy.result.rangeNote}</p>
            </>
          ) : (
            <p className="mt-1 font-display text-xl font-bold text-[#0e2a63]">{formatCurrency(r.net_cost)}</p>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-[#111827]/40 font-utility">{new Date(estimate.created_at).toLocaleString()}</p>
    </div>
  )
}

export default function EstimateSection({ onboardingId, copy }: { onboardingId: number; copy: EstimateCopy }) {
  const [open, setOpen] = useState(false)
  const [segment, setSegment] = useState('')
  const [roofType, setRoofType] = useState('')
  const [accessDifficulty, setAccessDifficulty] = useState<AccessDifficulty | ''>('')
  const [isHousingSociety, setIsHousingSociety] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: estimates, isLoading } = useOnboardingEstimates(onboardingId)
  const createMutation = useCreateEstimate()

  async function handleCreate() {
    setError(null)
    try {
      await createMutation.mutateAsync({
        id: onboardingId,
        input: {
          segment: segment || undefined,
          roof_type: roofType || undefined,
          access_difficulty: accessDifficulty || undefined,
          is_housing_society: isHousingSociety,
        },
      })
      setOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.structuredDetail?.code) {
        const code = err.structuredDetail.code as keyof EstimateCopy['errors']
        setError(copy.errors[code] ?? err.detail ?? err.message)
      } else {
        setError(err instanceof ApiError ? err.detail || err.message : 'Failed to create estimate')
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.history.title}</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-[#0e2a63] px-4 py-2 text-xs font-semibold text-white font-utility"
        >
          {copy.getEstimateButton}
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-4 space-y-3">
          <input
            className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-sm font-utility"
            placeholder={copy.fields.segmentLabel}
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-sm font-utility"
            placeholder={copy.fields.roofTypeLabel}
            value={roofType}
            onChange={(e) => setRoofType(e.target.value)}
          />
          <select
            className="w-full rounded-lg border border-[#e4e8ee] px-3 py-2 text-sm font-utility"
            value={accessDifficulty}
            onChange={(e) => setAccessDifficulty(e.target.value as AccessDifficulty)}
          >
            <option value="">{copy.fields.accessDifficulty.label}</option>
            <option value="easy">{copy.fields.accessDifficulty.easy}</option>
            <option value="moderate">{copy.fields.accessDifficulty.moderate}</option>
            <option value="difficult">{copy.fields.accessDifficulty.difficult}</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-utility">
            <input type="checkbox" checked={isHousingSociety} onChange={(e) => setIsHousingSociety(e.target.checked)} />
            {copy.fields.housingSocietyLabel}
          </label>
          {error && <p className="text-xs text-red-600 font-utility">{error}</p>}
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-[#0e2a63] px-4 py-2 text-sm font-semibold text-white font-utility disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : copy.getEstimateButton}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-[#111827]/30" />}
        {estimates && estimates.length === 0 && <p className="text-sm text-[#111827]/50 font-utility">{copy.history.empty}</p>}
        {estimates?.map((e) => <EstimateCard key={e.estimate_id} estimate={e} copy={copy} />)}
      </div>
    </div>
  )
}
