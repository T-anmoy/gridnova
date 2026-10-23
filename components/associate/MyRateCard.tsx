'use client'

import { useMyRate } from '@/lib/commissions/associate-api-client'
import { formatRate } from '@/lib/commissions/rates'
import { formatDate } from '@/lib/dashboard/utils'
import { useOptionalMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'

/**
 * "Your commission rate" (BE-12): the rate in effect for this Associate, whether it is the
 * standard rate or their individual one, and any change already scheduled. Every figure comes
 * from GET /associate/commission-rate — no rate is written here — and the internal reason is
 * never part of that response. If the rate cannot be read, the card is left out: earnings and
 * the home feed still work without it.
 */
export default function MyRateCard({ className = '' }: { className?: string }) {
  const copy = useOptionalMessages('portalEase')?.rate
  const { data, isLoading } = useMyRate()
  if (!copy) return null
  if (isLoading) return <div role="status" aria-busy="true" className={`h-28 animate-pulse rounded-2xl bg-[#eef1f6] ${className}`}><span className="sr-only">{copy.loading}</span></div>
  if (!data) return null

  const { effective, scheduled_changes: upcoming } = data
  const keyNames = copy.keys as Record<string, string>
  const confirmed = effective.rate_percent != null
  const individual = effective.source === 'individual'

  return (
    <section aria-labelledby="my-rate-title" data-testid="my-rate-card" data-source={effective.source ?? 'none'} className={`rounded-2xl border border-[#e4e8ee] bg-white p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="my-rate-title" className="font-display text-base font-semibold text-[#091c3c]">{copy.title}</h2>
          {keyNames[data.rate_key] && <p className="font-utility text-xs text-[#111827]/65">{keyNames[data.rate_key]}</p>}
        </div>
        {confirmed && (
          <span data-testid="my-rate-source" className={`rounded-full px-2.5 py-1 font-utility text-xs font-semibold ${individual ? 'bg-[#2f5daa]/10 text-[#0e2a63]' : 'bg-[#111827]/10 text-[#111827]/80'}`}>
            {individual ? copy.individual : copy.standard}
          </span>
        )}
      </div>

      {confirmed ? (
        <>
          <p className="mt-2 font-display text-3xl font-bold text-[#0e2a63]" data-testid="my-rate-value">{formatRate(effective.rate_percent)}</p>
          {effective.effective_from && <p className="mt-1 font-utility text-xs text-[#111827]/70">{fmt(copy.appliesFrom, { date: formatDate(effective.effective_from) })}</p>}
        </>
      ) : (
        <p className="mt-2 font-utility text-sm text-[#7a5200]" data-testid="my-rate-pending">{copy.pending}</p>
      )}
      <p className="mt-1 font-utility text-xs text-[#111827]/70">{copy.recorded}</p>

      {upcoming.length > 0 && (
        <div className="mt-3 border-t border-[#e4e8ee] pt-3" data-testid="my-rate-upcoming">
          <h3 className="font-utility text-xs font-semibold text-[#111827]/70">{copy.upcomingTitle}</h3>
          <ul className="mt-1 space-y-0.5 font-utility text-sm text-[#091c3c]">
            {upcoming.map((c) => (
              <li key={`${c.effective_from}-${c.rate_percent ?? 'none'}`}>
                {c.rate_percent != null ? fmt(copy.upcoming, { date: formatDate(c.effective_from), rate: formatRate(c.rate_percent) }) : fmt(copy.upcomingNone, { date: formatDate(c.effective_from) })}
                {c.rate_percent != null && c.source ? ` (${c.source === 'individual' ? copy.upcomingIndividual : copy.upcomingStandard})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
