'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { QueuePager } from '@/components/dashboard/QueuePager'
import SelectField from '@/components/dashboard/SelectField'
import { RequestBadges, SlaText } from '@/components/dashboard/handover/ServiceRequestRow'
import { useWorkQueues } from '@/lib/dashboard/execution-api-client'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { formatDate } from '@/lib/dashboard/utils'
import { CATEGORY_LABEL, STATUS_LABEL, categoryLabel } from '@/lib/handover/labels'
import { useServiceQueue } from '@/lib/handover/staff-api-client'

const PAGE_SIZE = 25
const opts = (map: Record<string, string>, any: string) => [{ value: '', label: any }, ...Object.entries(map).map(([value, label]) => ({ value, label }))]

export default function ServiceRequestQueue() {
  const url = useUrlParams()
  const { data: queues } = useWorkQueues()
  const counts = queues?.service_requests
  const warranty = url.get('warranty')
  const { data, isLoading, error, refetch, isFetching } = useServiceQueue({
    status: url.get('status') || undefined,
    open: url.get('open') === '1' || undefined,
    overdue: url.get('overdue') === '1' || undefined,
    within_warranty: warranty === 'in' ? true : warranty === 'out' ? false : undefined,
    category: url.get('category') || undefined,
    assignee: url.get('assignee') || undefined,
    page: url.page,
    page_size: PAGE_SIZE,
  })

  return (
    <div className="space-y-4">
      {counts && (
        <dl className="grid grid-cols-2 gap-3 sm:max-w-md" data-testid="service-counts">
          <Card><CardContent className="p-4"><dt className="text-xs text-gray-500">Open requests</dt><dd className="text-2xl font-bold">{counts.open}</dd></CardContent></Card>
          <Card><CardContent className="p-4"><dt className="text-xs text-gray-500">Overdue</dt><dd className={`text-2xl font-bold ${counts.overdue > 0 ? 'text-red-700' : ''}`}>{counts.overdue}</dd></CardContent></Card>
        </dl>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <SelectField className="w-[48%] sm:w-40" label="Status" value={url.get('status')} onChange={(v) => url.set({ status: v || undefined })} options={opts(STATUS_LABEL, 'All statuses')} />
        <SelectField className="w-[48%] sm:w-44" label="Problem" value={url.get('category')} onChange={(v) => url.set({ category: v || undefined })} options={opts(CATEGORY_LABEL, 'All problems')} />
        <SelectField className="w-[48%] sm:w-44" label="Warranty" value={warranty} onChange={(v) => url.set({ warranty: v || undefined })} options={[{ value: '', label: 'Any' }, { value: 'in', label: 'Within warranty' }, { value: 'out', label: 'Out of warranty' }]} />
        <SelectField className="w-[48%] sm:w-40" label="Assigned to" value={url.get('assignee')} onChange={(v) => url.set({ assignee: v || undefined })} options={[{ value: '', label: 'Anyone' }, { value: 'me', label: 'Me' }, { value: 'unassigned', label: 'Unassigned' }]} />
        <Button variant={url.get('open') === '1' ? 'default' : 'outline'} className="h-11 md:h-9" aria-pressed={url.get('open') === '1'} onClick={() => url.set({ open: url.get('open') === '1' ? undefined : '1' })}>Open only</Button>
        <Button variant={url.get('overdue') === '1' ? 'default' : 'outline'} className="h-11 md:h-9" aria-pressed={url.get('overdue') === '1'} onClick={() => url.set({ overdue: url.get('overdue') === '1' ? undefined : '1' })}>Overdue only</Button>
      </div>
      {error && <DashboardError error={error} onRetry={() => void refetch()} />}
      <Card>
        <CardContent className="p-0">
          <Table aria-busy={isFetching}>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warranty ends</TableHead>
                <TableHead>SLA due</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Photos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>}
              {data?.items.map((r) => (
                <TableRow key={r.request_id} data-testid="service-request-row">
                  <TableCell className="max-w-xs text-sm">
                    <Link href={`/dashboard/service-requests/${r.request_id}`} className="inline-flex min-h-[44px] items-center font-medium text-[#0e2a63] underline">#{r.request_id} · {categoryLabel(r.category)}</Link>
                    <p className="line-clamp-2 text-gray-700">{r.description}</p>
                    <p className="text-xs text-gray-500">Raised {formatDate(r.created_at)}{r.raised_via ? ` via ${r.raised_via}` : ''}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p className="text-gray-900">{r.customer_name ?? '—'}</p>
                    {r.onboarding_id != null ? (
                      <Link className="inline-flex min-h-[44px] items-center text-xs text-[#0e2a63] underline" href={`/dashboard/operations/${r.onboarding_id}?tab=service`}>{r.project_reference_id ?? 'Open project'}</Link>
                    ) : (
                      <p className="text-xs text-gray-500">{r.project_reference_id}</p>
                    )}
                  </TableCell>
                  <TableCell><RequestBadges request={r} /></TableCell>
                  <TableCell className="text-sm">{r.warranty_end ? formatDate(r.warranty_end) : <span className="text-gray-500">Unknown</span>}</TableCell>
                  <TableCell className="text-sm"><SlaText request={r} /></TableCell>
                  <TableCell className="text-sm">{r.assignee_id ? r.assignee_id : <Badge variant="outline">Unassigned</Badge>}</TableCell>
                  <TableCell className="text-sm">{r.photo_count ?? 0}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">No service requests match.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {data && <QueuePager page={url.page} pageSize={PAGE_SIZE} total={data.total} onPage={url.setPage} />}
    </div>
  )
}
