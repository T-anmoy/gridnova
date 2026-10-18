'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { schemeLabel } from '@/lib/archive/logic'
import type { ArchiveStats } from '@/lib/archive/schemas'

/** Counts and capacity for the current filters, as the backend computed them in SQL. */
export function ArchiveStatsStrip({ stats, loading, failed, onRetry }: { stats: ArchiveStats | undefined; loading: boolean; failed: boolean; onRetry: () => void }) {
  if (loading && !stats) return <Skeleton className="h-20 w-full" />
  if (failed && !stats) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        Couldn’t load the summary.
        <button type="button" className="min-h-[44px] underline" onClick={onRetry}>Retry</button>
      </div>
    )
  }
  if (!stats) return null
  return (
    <section aria-label="Archive summary" className="space-y-2 rounded-xl border border-[#e4e8ee] bg-white p-3 md:p-4" data-testid="archive-stats">
      <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div>
          <dt className="text-xs text-gray-500">Projects</dt>
          <dd className="font-display text-xl font-semibold text-[#091c3c]" data-testid="stats-count">{stats.total.count}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Total capacity</dt>
          <dd className="font-display text-xl font-semibold text-[#091c3c]" data-testid="stats-capacity">{stats.total.capacity_kw} kW</dd>
        </div>
      </dl>
      {stats.by_scheme.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="By scheme">
          {stats.by_scheme.map((s) => (
            <li key={s.scheme} className="rounded-full bg-[#f7f9fc] px-3 py-1 text-xs text-gray-700">
              {schemeLabel(s.scheme)}: <span className="font-semibold">{s.count}</span> · {s.capacity_kw} kW
            </li>
          ))}
        </ul>
      )}
      {stats.by_year.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="By year">
          {stats.by_year.map((y) => (
            <li key={y.year} className="rounded-full bg-[#f7f9fc] px-3 py-1 text-xs text-gray-700">
              {y.year}: <span className="font-semibold">{y.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
