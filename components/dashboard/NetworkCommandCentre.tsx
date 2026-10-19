'use client'

import { Suspense, useId } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import NoAccess from '@/components/dashboard/NoAccess'
import { associateRows, fillPercent, overdueItems, stageRows } from '@/lib/commissions/network'
import { useNetworkSummary } from '@/lib/commissions/staff-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { formatInr, isNegativeAmount } from '@/lib/money'

// Recharts is loaded lazily so it is not in this page's first JS.
const ChartSkeleton = ({ title }: { title: string }) => (
  <Card>
    <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent><Skeleton className="h-[200px] w-full rounded-lg" /></CardContent>
  </Card>
)
const OnboardingFunnelChart = dynamic(() => import('@/components/dashboard/network-charts').then((m) => m.OnboardingFunnelChart), {
  ssr: false,
  loading: () => <ChartSkeleton title="Onboarding funnel" />,
})
const AssociatesChart = dynamic(() => import('@/components/dashboard/network-charts').then((m) => m.AssociatesChart), {
  ssr: false,
  loading: () => <ChartSkeleton title="Associates by type and status" />,
})

function Stat({ label, value, negativeAware }: { label: string; value: string; negativeAware?: boolean }) {
  const neg = negativeAware && isNegativeAmount(value)
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-lg font-bold ${neg ? 'text-red-700' : 'text-[#091c3c]'}`}>{formatInr(value)}</dd>
    </div>
  )
}

function Meter({ label, held, max }: { label: string; held: number; max: number }) {
  const pct = fillPercent(held, max)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-[#091c3c]">{held} of {max}</span>
      </div>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={held} aria-valuetext={`${held} of ${max}`} className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#e4e8ee]">
        <div className="h-full rounded-full bg-[#0e2a63]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Mounted only for Admin and Management, so no other role ever makes the request.
function Summary({ role }: { role: string }) {
  const url = useUrlParams()
  const id = useId()
  const from = url.get('from')
  const to = url.get('to')
  const { data, error, refetch, isLoading, isFetching } = useNetworkSummary({ date_from: from || undefined, date_to: to || undefined })

  const invalidPeriod = error instanceof ApiError && error.structuredDetail?.code === 'invalid_period'
  const assoc = data ? associateRows(data.associates) : null

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#091c3c]">Network Command Centre</h1>
          {data && (
            <p className="mt-1 text-sm text-gray-500" data-testid="period" aria-live="polite">
              Money and commission figures cover {formatDate(data.period.date_from)} – {formatDate(data.period.date_to)}. Everything else is as of {formatDatetime(data.generated_at)}.
            </p>
          )}
        </div>
        <form
          aria-label="Period"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            url.set({ from: String(f.get('from') ?? '') || undefined, to: String(f.get('to') ?? '') || undefined })
          }}
        >
          <div>
            <label htmlFor={`${id}-from`} className="mb-1 block text-xs text-gray-500">From</label>
            <Input id={`${id}-from`} name="from" type="date" key={from} defaultValue={from} className="h-11 w-40 md:h-9" />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="mb-1 block text-xs text-gray-500">To</label>
            <Input id={`${id}-to`} name="to" type="date" key={to} defaultValue={to} className="h-11 w-40 md:h-9" />
          </div>
          <Button type="submit" variant="outline" className="h-11 md:h-9">Apply</Button>
        </form>
      </div>

      {invalidPeriod ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That period is not valid. Choose dates no more than 366 days apart, with the start before the end.
        </p>
      ) : error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : null}

      {isLoading && !data && <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}

      {data && (
        <div className="space-y-6" aria-busy={isFetching}>
          <section aria-labelledby={`${id}-overdue`}>
            <h2 id={`${id}-overdue`} className="mb-3 text-lg font-semibold text-[#091c3c]">Needs attention</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="overdue-list">
              {overdueItems(data.overdue, role).map((item) => {
                const inner = (
                  <>
                    <span className={`text-3xl font-bold ${item.count > 0 ? 'text-red-700' : 'text-[#091c3c]'}`}>{item.count}</span>
                    <span className="mt-1 block text-sm text-gray-700">{item.label}</span>
                    {item.href && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0e2a63]">Open the queue <ArrowRight className="h-3 w-3" aria-hidden="true" /></span>}
                  </>
                )
                return (
                  <li key={item.key}>
                    {item.href ? (
                      <Link href={item.href} data-testid={`overdue-${item.key}`} className="flex min-h-[44px] flex-col rounded-xl border border-[#e4e8ee] bg-white p-4 hover:bg-[#f7f9fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">
                        {inner}
                      </Link>
                    ) : (
                      <div data-testid={`overdue-${item.key}`} className="flex min-h-[44px] flex-col rounded-xl border border-[#e4e8ee] bg-white p-4">{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-labelledby={`${id}-money`} className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle id={`${id}-money`} className="text-base">Verified revenue</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-3" data-testid="revenue">
                  <Stat label="Credits" value={data.verified_revenue.credits} />
                  <Stat label="Reversals" value={data.verified_revenue.reversals} negativeAware />
                  <Stat label="Net" value={data.verified_revenue.net} negativeAware />
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Commissions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="commission-money">
                  <Stat label="Earned" value={data.commissions.earned} />
                  <Stat label="Reversed" value={data.commissions.reversed} negativeAware />
                  <Stat label="Approved" value={data.commissions.approved} />
                  <Stat label="Paid (net)" value={data.commissions.paid_net} />
                  <Stat label="TDS deducted" value={data.commissions.paid_tds} />
                </dl>
                <p className="text-sm text-gray-700">
                  {data.commissions.pending_count > 0 ? (
                    <Link className="font-medium text-[#0e2a63] underline" href="/dashboard/commissions?pending=1">
                      {data.commissions.pending_count} {data.commissions.pending_count === 1 ? 'earning is' : 'earnings are'} waiting for a rate
                    </Link>
                  ) : (
                    'No earnings are waiting for a rate.'
                  )}
                </p>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby={`${id}-charts`} className="space-y-4">
            <h2 id={`${id}-charts`} className="text-lg font-semibold text-[#091c3c]">Associates and onboarding</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {assoc && <AssociatesChart rows={assoc.rows} statuses={assoc.statuses} />}
              <OnboardingFunnelChart rows={stageRows(data.onboardings.by_current_stage)} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Onboardings by status</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="onboarding-status">
                  {Object.entries(data.onboardings.by_status).map(([status, n]) => (
                    <div key={status}>
                      <dt className="text-xs capitalize text-gray-500">{status.replace(/_/g, ' ')}</dt>
                      <dd className="text-2xl font-bold text-[#091c3c]">{n}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-gray-500">The funnel above excludes closed onboardings.</p>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby={`${id}-seats`}>
            <h2 id={`${id}-seats`} className="mb-3 text-lg font-semibold text-[#091c3c]">Territory seats</h2>
            {data.seats.length === 0 ? (
              <p className="text-sm text-gray-500">No territories are set up yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.seats.map((s) => (
                  <Card key={s.state_lgd_code} data-testid="seat-card">
                    <CardHeader className="pb-2"><CardTitle className="text-base">{s.state_name}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <Meter label="State Heads" held={s.state_heads.held} max={s.state_heads.max} />
                      <Meter label="Districts with a head" held={s.districts.with_head} max={s.districts.total} />
                      <Meter label="Blocks with an associate" held={s.blocks.with_associate} max={s.blocks.total} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Badge variant="outline">Note</Badge>
            <span>Overdue payment instalments are not counted here — they are worked out per project. See Accounts → Instalments.</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Gate() {
  const { role, isLoaded } = useStaffRole()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-8 w-56" /></div>
  if (role !== 'admin' && role !== 'management') return <NoAccess what="The Network Command Centre" />
  return <Summary role={role} />
}

export default function NetworkCommandCentre() {
  // useSearchParams (the period lives in the URL) needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="p-6 md:p-8"><Skeleton className="h-8 w-56" /></div>}>
      <Gate />
    </Suspense>
  )
}
