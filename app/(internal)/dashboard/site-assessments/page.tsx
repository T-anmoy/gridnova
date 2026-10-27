'use client'

import { Suspense } from 'react'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { useProposalInputs } from '@/lib/dashboard/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/dashboard/utils'
import type { ProposalInputStatus } from '@/lib/dashboard/types'
import { RequirePermission } from '@/components/dashboard/RequirePermission'

const STATUS_OPTIONS: ProposalInputStatus[] = ['submitted', 'under_review', 'approved_for_proposal', 'rejected']

function statusVariant(status: ProposalInputStatus) {
  const map: Record<ProposalInputStatus, string> = {
    submitted: 'amber',
    under_review: 'blue',
    approved_for_proposal: 'green',
    rejected: 'gray',
  }
  return (map[status] ?? 'gray') as 'amber' | 'blue' | 'green' | 'gray'
}

export default function SiteAssessmentsPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      {/* Hiding the nav item is UX only — this direct-link guard is the honest no-access state
          the backend's own 403 would otherwise surface as a raw error. */}
      <RequirePermission rule="proposal_inputs.manage" what="Site assessments">
        <SiteAssessments />
      </RequirePermission>
    </Suspense>
  )
}

function SiteAssessments() {
  // The status filter lives in the URL; with no ?status= the queue opens on
  // 'submitted', and ?status=all shows every status.
  const url = useUrlParams()
  const rawStatus = url.has('status') ? url.get('status') : 'submitted'
  const statusFilter = (rawStatus === 'all' ? '' : rawStatus) as ProposalInputStatus | ''

  const { data, isLoading, error, refetch } = useProposalInputs({ status: statusFilter || undefined, page_size: 50 })


  // Newest first — the backend has no documented sort param for this list, so
  // sort defensively on the client rather than trust an unspecified order.
  const items = [...(data?.items ?? [])].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Site Assessments</h1>
        <p className="font-utility text-sm text-[#111827]/65 mt-1">{data?.total ?? 0} total</p>
      </div>

      <Card className="mb-4">
        <div className="p-4 flex items-center gap-3">
          <span className="font-utility text-sm text-[#111827]/60">Status</span>
          <Select value={statusFilter} onValueChange={(v) => url.set({ status: v === '' ? 'all' : v })}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Project Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 font-utility text-[#111827]/65">
                        No site assessments found
                      </TableCell>
                    </TableRow>
                  )
                : items.map((item) => (
                    <ClickableRow
                      key={item.id}
                      className="hover:bg-[#f7f9fc] transition-colors"
                      href={`/dashboard/site-assessments/${item.id}`}
                    >
                      <TableCell className="font-utility font-medium text-[#091c3c]">
                        <Link href={`/dashboard/site-assessments/${item.id}`} className="hover:underline">
                          #{item.id}</Link>
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">#{item.lead_id}</TableCell>
                      <TableCell className="font-utility text-sm">{item.project_family.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{item.district}, {item.state}</TableCell>
                      <TableCell><Badge variant={statusVariant(item.status)}>{item.status.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(item.created_at)}</TableCell>
                    </ClickableRow>
                  ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
