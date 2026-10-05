'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { useExecutionQueue, useWorkQueues } from '@/lib/dashboard/execution-api-client'
import { STAFF_EXECUTION_COPY } from '@/lib/dashboard/staff-copy'
import { formatDate } from '@/lib/dashboard/utils'

const REASON_LABEL: Record<string, string> = {
  pending_verification: 'Awaiting verification',
  stuck: 'Stuck',
  dcr_mismatch: 'DCR mismatch',
  capacity_mismatch: 'Capacity mismatch',
}

const STAGES = Object.entries(STAFF_EXECUTION_COPY.stages)

// Operations workspace: the execution queue. Needs-attention (pending
// verification, stuck, DCR / capacity mismatch) is one click, and every
// stalled project is marked in its row — never only in a timeline. No payment
// or money field exists on this screen.
export default function OperationsPage() {
  const router = useRouter()
  const [needsAttention, setNeedsAttention] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [stage, setStage] = useState('')
  const [mode, setMode] = useState<'' | 'associate' | 'grid_nova'>('')
  const [page, setPage] = useState(1)
  const { data: queues } = useWorkQueues()

  const { data, isLoading, error, refetch } = useExecutionQueue({
    needs_attention: needsAttention || undefined,
    stuck: stuck || undefined,
    stage: stage || undefined,
    mode: mode || undefined,
    page,
    page_size: 25,
  })

  const exec = queues?.execution
  const reset = () => setPage(1)

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[#091c3c]">Operations</h1>
        <p className="mt-1 text-sm text-gray-500">Installation progress for projects after the signed agreement.</p>
      </div>

      {exec && (
        <div className="grid gap-3 sm:grid-cols-3" data-testid="queue-summary">
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Awaiting verification</p><p className="text-2xl font-bold">{exec.pending_stage_verifications}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Stuck projects</p><p className="text-2xl font-bold">{exec.stuck_projects}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">DCR mismatch</p><p className="text-2xl font-bold">{exec.dcr_mismatch}</p></CardContent></Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant={needsAttention ? 'default' : 'outline'} size="sm" aria-pressed={needsAttention} onClick={() => { setNeedsAttention((v) => !v); reset() }}>
          Needs attention
        </Button>
        <Button variant={stuck ? 'default' : 'outline'} size="sm" aria-pressed={stuck} onClick={() => { setStuck((v) => !v); reset() }}>
          Stuck only
        </Button>
        <Select value={stage || 'all'} onValueChange={(v) => { setStage(v === 'all' ? '' : v); reset() }}>
          <SelectTrigger className="w-52" aria-label="Current stage"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mode || 'all'} onValueChange={(v) => { setMode(v === 'all' ? '' : (v as 'associate' | 'grid_nova')); reset() }}>
          <SelectTrigger className="w-44" aria-label="Who executes"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any mode</SelectItem>
            <SelectItem value="associate">Associate executes</SelectItem>
            <SelectItem value="grid_nova">Grid Nova executes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <DashboardError error={error} onRetry={() => void refetch()} />}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>In stage</TableHead>
                  <TableHead>Attention</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((item) => (
                  <TableRow
                    key={item.onboarding_id}
                    className="cursor-pointer"
                    data-testid="queue-row"
                    onClick={() => router.push(`/dashboard/operations/${item.onboarding_id}`)}
                  >
                    <TableCell>
                      <p className="font-medium text-gray-900">{item.customer_name}</p>
                      {item.project_reference_id && <p className="text-xs text-gray-400">{item.project_reference_id}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{item.next_stage_label ?? item.next_stage ?? '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{item.execution_mode === 'grid_nova' ? 'Grid Nova' : 'Associate'}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {item.days_in_stage ?? '—'}{item.days_in_stage != null ? ' d' : ''}
                      {item.is_stuck && <Badge variant="red" className="ml-2" data-testid="row-stuck">Stuck</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.pending_submission && <Badge variant="amber">Awaiting verification</Badge>}
                        {item.flags.map((f) => <Badge key={f} variant="orange">{REASON_LABEL[f] ?? f.replace(/_/g, ' ')}</Badge>)}
                        {item.attention_reasons.filter((r) => r !== 'pending_verification' && r !== 'stuck' && !item.flags.includes(r)).map((r) => <Badge key={r} variant="orange">{REASON_LABEL[r] ?? r.replace(/_/g, ' ')}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(item.started_at)}</TableCell>
                  </TableRow>
                ))}
                {data && data.items.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500">No projects match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {data.page} of {Math.ceil(data.total / data.page_size)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.page_size)} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
