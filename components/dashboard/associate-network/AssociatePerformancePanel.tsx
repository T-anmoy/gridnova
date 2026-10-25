'use client'

import { useId, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { rangeProblem } from '@/lib/commissions/individual-rate'
import { useAssociatePerformance } from '@/lib/commissions/staff-api-client'
import DateField from '@/components/forms/DateField'

function Figure({ label, hint, children, testId }: { label: string; hint?: string; children: React.ReactNode; testId: string }) {
  return (
    <div className="rounded-xl border border-[#e4e8ee] bg-white px-3 py-3" data-testid={testId}>
      <dt className="font-utility text-xs text-[#111827]/70">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-bold text-[#0e2a63]">{children}</dd>
      {hint && <p className="mt-0.5 font-utility text-[11px] leading-snug text-[#111827]/65">{hint}</p>}
    </div>
  )
}

/**
 * How this Associate has done, so a rate decision rests on data (BE-12). No installed-capacity
 * figure: the backend has none. With no dates the server's default (this month so far) is used.
 */
export default function AssociatePerformancePanel({ associateId }: { associateId: string }) {
  const id = useId()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const problem = rangeProblem(from, to)
  const range = from && to && !problem ? { date_from: from, date_to: to } : {}
  const { data, isLoading, error, refetch } = useAssociatePerformance(associateId, range)

  if (error instanceof ApiError && error.status === 403) return null

  return (
    <Card className="p-6" data-testid="performance-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-display text-sm font-semibold text-[#091c3c]">Performance</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-from`} className="mb-1 block text-xs text-gray-600">From</label>
          <DateField id={`${id}-from`} variant="dashboard" label="From" max={to || undefined} value={from} onChange={setFrom} />
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="mb-1 block text-xs text-gray-600">To</label>
          <DateField id={`${id}-to`} variant="dashboard" label="To" min={from || undefined} value={to} onChange={setTo} />
        </div>
      </div>
      {problem ? (
        <p role="alert" className="mt-2 text-sm text-red-600" data-testid="range-problem">{problem}</p>
      ) : (
        <p className="mt-2 text-xs text-gray-500">{from && to ? 'Showing the dates you chose.' : 'Leave both dates empty for this month so far.'}</p>
      )}

      <div className="mt-3">
        {error ? (
          <DashboardError error={error} onRetry={() => void refetch()} />
        ) : isLoading || !data ? (
          <div className="grid grid-cols-2 gap-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        ) : (
          <>
            <p className="mb-2 text-xs text-gray-500" data-testid="performance-period">
              {formatDate(data.period.date_from)} to {formatDate(data.period.date_to)}
            </p>
            <dl className="grid grid-cols-2 gap-2">
              <Figure label="Customers onboarded" testId="perf-onboarded">{data.customers.onboarded}</Figure>
              <Figure label="Customers verified" testId="perf-verified">{data.customers.verified}</Figure>
              <Figure label="Customers commissioned" testId="perf-commissioned">{data.customers.commissioned}</Figure>
              <Figure label="Verified payments" hint={`Credits ${formatInr(data.verified_payments.credits)}, reversals ${formatInr(data.verified_payments.reversals)}`} testId="perf-payments">
                {formatInr(data.verified_payments.net)}
              </Figure>
              <Figure label="Commission earned" hint={`Own sales ${formatInr(data.commission.earned_personal_sale)}`} testId="perf-earned">
                {formatInr(data.commission.earned)}
              </Figure>
              <Figure label="Commission reversed" hint={data.commission.pending_count > 0 ? `${data.commission.pending_count} still without an amount` : undefined} testId="perf-reversed">
                {formatInr(data.commission.reversed)}
              </Figure>
            </dl>
          </>
        )}
      </div>
    </Card>
  )
}
