'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { QueuePager } from '@/components/dashboard/QueuePager'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import SelectField from '@/components/dashboard/SelectField'
import { commissionErrorMessage, ENTRY_STATUS_LABEL } from '@/lib/commissions/labels'
import type { CommissionQuery } from '@/lib/commissions/schemas'
import { useStaffCommissionQueries, useRespondToQuery } from '@/lib/commissions/staff-api-client'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { formatInr, isNegativeAmount } from '@/lib/money'
import { usePermissions } from '@/lib/access/use-permissions'

const PAGE_SIZE = 25

export default function CommissionQueries() {
  const { can } = usePermissions()
  const canAct = can('commissions.process')
  const url = useUrlParams()
  const status = url.get('status')
  const overdue = url.get('overdue') === '1'
  const { data, isLoading, error, refetch } = useStaffCommissionQueries({ status: status || undefined, overdue, page: url.page, page_size: PAGE_SIZE })
  const respond = useRespondToQuery()
  const [target, setTarget] = useState<CommissionQuery | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          className="w-full sm:w-44"
          label="Status"
          value={status}
          onChange={(v) => url.set({ status: v || undefined })}
          options={[{ value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'answered', label: 'Answered' }]}
        />
        <Button variant={overdue ? 'default' : 'outline'} className="h-11 md:h-9" aria-pressed={overdue} onClick={() => url.set({ overdue: overdue ? undefined : '1' })}>
          Overdue only
        </Button>
        <p className="text-xs text-gray-500">Oldest due first. An answer is due 15 working days after the query.</p>
      </div>
      {notice && <p role="status" className="rounded-lg border border-[#e4e8ee] bg-white px-4 py-2 text-sm text-gray-700">{notice}</p>}
      {error && <DashboardError error={error} onRetry={() => void refetch()} />}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Associate</TableHead>
                <TableHead>Earning</TableHead>
                <TableHead>Query</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Answer</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>}
              {data?.items.map((q) => (
                <TableRow key={q.query_id} data-testid="query-row">
                  <TableCell className="text-sm">
                    <p className="font-medium text-gray-900">{q.associate?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{q.associate?.associate_id}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {q.entry ? (
                      <>
                        <Link className="inline-flex min-h-[44px] items-center text-[#0e2a63] underline" href={`/dashboard/commissions?${new URLSearchParams({ associate: q.entry.associate?.associate_id ?? '' })}`}>
                          Entry #{q.entry.entry_id}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {q.entry.customer_name ?? '—'} ·{' '}
                          <span className={isNegativeAmount(q.entry.amount) ? 'text-red-700' : undefined}>{q.entry.amount != null ? formatInr(q.entry.amount) : 'Rate to be published'}</span>
                          {' · '}{ENTRY_STATUS_LABEL[q.entry.status] ?? q.entry.status}
                        </p>
                      </>
                    ) : (
                      `Entry #${q.entry_id}`
                    )}
                  </TableCell>
                  <TableCell className="max-w-md text-sm">
                    <p className="whitespace-pre-wrap break-words text-gray-900">{q.message}</p>
                    <p className="text-xs text-gray-500">Asked {formatDatetime(q.created_at)}</p>
                    {q.response && (
                      <div className="mt-2 rounded-lg bg-[#f7f9fc] p-2">
                        <p className="whitespace-pre-wrap break-words text-gray-800">{q.response}</p>
                        <p className="text-xs text-gray-500">Answered {formatDatetime(q.responded_at)}{q.responded_by ? ` by ${q.responded_by}` : ''}</p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(q.due_at)}
                    {q.overdue && q.status !== 'answered' && <Badge variant="red" className="ml-2" data-testid="overdue-badge">Overdue</Badge>}
                  </TableCell>
                  <TableCell><Badge variant={q.status === 'answered' ? 'green' : 'amber'}>{q.status === 'answered' ? 'Answered' : 'Open'}</Badge></TableCell>
                  <TableCell>
                    {canAct && q.status !== 'answered' && (
                      <Button size="sm" variant="outline" className="min-h-[44px] md:min-h-0" onClick={() => setTarget(q)}>
                        Answer <span className="sr-only">query {q.query_id}</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500">No queries match.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {data && <QueuePager page={url.page} pageSize={PAGE_SIZE} total={data.total} onPage={url.setPage} />}
      <ReasonDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Answer query #${target?.query_id ?? ''}`}
        description={target ? `“${target.message}”` : undefined}
        label="Your answer (the associate sees this)"
        required
        confirmLabel="Send answer"
        describeError={commissionErrorMessage}
        onConfirm={async (response) => {
          await respond.mutateAsync({ queryId: target!.query_id, response })
          setNotice('Answer sent.')
        }}
      />
    </div>
  )
}
