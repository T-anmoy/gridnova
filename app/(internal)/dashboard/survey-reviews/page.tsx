'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import { QueuePager } from '@/components/dashboard/QueuePager'
import { DashboardError } from '@/components/dashboard/DashboardError'
import NoAccess from '@/components/dashboard/NoAccess'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { useSurveyReviewQueue } from '@/lib/dashboard/survey-review-api-client'
import { SURVEY_QUEUE_STATES, type SurveyQueueState } from '@/lib/dashboard/survey-review-types'
import { OUTCOME_LABEL, OUTCOME_VARIANT, isSurveyReader } from '@/lib/dashboard/survey-review-ui'
import { formatDatetime } from '@/lib/dashboard/utils'

const PAGE_SIZE = 25
const TAB_LABEL: Record<SurveyQueueState, string> = { awaiting: 'Awaiting', overdue: 'Overdue', reviewed: 'Reviewed', revised: 'Revised' }

export default function SurveyReviewsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SurveyReviews />
    </Suspense>
  )
}

function SurveyReviews() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const { role, isLoaded } = useStaffRole()
  const rawState = sp.get('state')
  const state: SurveyQueueState = (SURVEY_QUEUE_STATES as readonly string[]).includes(rawState ?? '') ? (rawState as SurveyQueueState) : 'awaiting'
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const { data, isLoading, error, refetch } = useSurveyReviewQueue({ state, page, page_size: PAGE_SIZE })

  function go(next: { state?: SurveyQueueState; page?: number }) {
    const q = new URLSearchParams()
    const s = next.state ?? state
    if (s !== 'awaiting') q.set('state', s)
    if ((next.page ?? 1) > 1) q.set('page', String(next.page))
    const qs = q.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  if (isLoaded && !isSurveyReader(role)) return <NoAccess what="The survey review queue" />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Survey reviews</h1>
        <p className="text-sm text-gray-500">
          Signed surveys waiting for a feasibility review{data ? ` (target ${data.review_target_hours} hours)` : ''}.
        </p>
      </div>

      <div role="tablist" aria-label="Survey review state" className="flex flex-wrap gap-1">
        {SURVEY_QUEUE_STATES.map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={state === s}
            onClick={() => go({ state: s })}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-utility font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${state === s ? 'bg-[#091c3c] text-white' : 'bg-white text-[#091c3c] border border-[#e4e8ee]'}`}
          >
            {TAB_LABEL[s]}
          </button>
        ))}
      </div>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="rounded-xl border border-[#e4e8ee] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Associate</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Waiting since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 5 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : !data || data.items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-gray-400">Nothing here.</TableCell></TableRow>
              ) : (
                data.items.map((it) => (
                  <ClickableRow key={it.onboarding_id} href={`/dashboard/onboardings/${it.onboarding_id}`} data-testid="survey-review-row">
                    <TableCell>
                      <Link href={`/dashboard/onboardings/${it.onboarding_id}`} className="font-medium text-[#0e2a63] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#2f5daa]">
                        {it.customer_name ?? `Customer ${it.onboarding_id}`}
                      </Link>
                      <p className="text-xs text-gray-500">{it.client_code ?? '—'}</p>
                    </TableCell>
                    <TableCell className="text-sm">{it.associate?.name ?? '—'}</TableCell>
                    <TableCell>
                      {it.hours_waiting == null ? '—' : <span>{it.hours_waiting} h</span>}
                      {it.overdue && <Badge variant="red" className="ml-2">Overdue</Badge>}
                      {it.revised_after_review && <Badge variant="amber" className="ml-2">Revised</Badge>}
                    </TableCell>
                    <TableCell>
                      {it.review.outcome ? <Badge variant={OUTCOME_VARIANT[it.review.outcome]}>{OUTCOME_LABEL[it.review.outcome]}</Badge> : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDatetime(it.waiting_since)}</TableCell>
                  </ClickableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {data && <QueuePager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => go({ page: p })} />}
    </div>
  )
}
