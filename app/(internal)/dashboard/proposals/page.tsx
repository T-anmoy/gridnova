'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useAuth } from '@clerk/nextjs'
import { Filter, ChevronLeft, ChevronRight, ShieldCheck, Download, CheckCircle, Clock } from 'lucide-react'
import { useProposals, downloadProposalsCsv } from '@/lib/dashboard/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/dashboard/utils'
import type { ProposalStatus, Role } from '@/lib/dashboard/types'

const STATUS_OPTIONS: ProposalStatus[] = [
  'draft', 'pending_pricing_validation', 'pending_approval', 'revision_requested', 'approved', 'sent',
]

function statusVariant(status: ProposalStatus) {
  const map: Record<ProposalStatus, string> = {
    draft: 'gray',
    pending_pricing_validation: 'blue',
    pending_approval: 'amber',
    revision_requested: 'orange',
    approved: 'green',
    sent: 'navy',
  }
  return map[status] as 'gray' | 'blue' | 'amber' | 'orange' | 'green' | 'navy'
}

const PAGE_SIZE = 50

export default function ProposalsPage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const role = user?.publicMetadata?.role as Role | undefined

  const [statusFilter, setStatusFilter] = useState<ProposalStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const canExport = role === 'admin' || role === 'management'

  const { data, isLoading, error, refetch } = useProposals({
    status: statusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    page_size: PAGE_SIZE,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  async function handleExport() {
    setExporting(true)
    try {
      const token = await getToken()
      if (!token) return
      await downloadProposalsCsv(
        {
          status: statusFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        token
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Proposals</h1>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">{total} total proposals</p>
        </div>
        {canExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#111827]/40" />
              <span className="font-utility text-sm text-[#111827]/60">Filters</span>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ProposalStatus | ''); setPage(1) }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-36"
              title="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-36"
              title="To date"
            />
            {(statusFilter || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Sign-Off</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : items.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 font-utility text-[#111827]/40">
                          No proposals found
                        </TableCell>
                      </TableRow>
                    )
                  : items.map((p) => (
                      <ClickableRow
                        key={p.id}
                        href={`/dashboard/proposals/${p.id}`}
                        className="hover:bg-[#f7f9fc] transition-colors"
                      >
                        <TableCell className="font-utility font-medium text-[#091c3c]">
                          <Link href={`/dashboard/proposals/${p.id}`} className="hover:underline">#{p.id}</Link>
                        </TableCell>
                        <TableCell className="font-utility text-sm">{p.customer?.name ?? '—'}</TableCell>
                        <TableCell className="font-utility text-sm text-[#111827]/60">#{p.lead_id}</TableCell>
                        <TableCell className="font-utility text-sm">v{p.version}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(p.status)}>{p.status.replace(/_/g, ' ')}</Badge>
                          {p.needs_reverification && <Badge variant="amber" className="ml-1.5" data-testid="list-reverify-badge">Re-verify</Badge>}
                        </TableCell>
                        <TableCell className="font-utility text-sm">{formatCurrency(p.total_value)}</TableCell>
                        <TableCell>
                          {p.requires_manager_signoff && (
                            <ShieldCheck className="h-4 w-4 text-amber-500" aria-label="Manager sign-off required" />
                          )}
                        </TableCell>
                        <TableCell>
                          {p.status === 'sent' && (
                            p.accepted_at ? (
                              <CheckCircle className="h-4 w-4 text-green-600" aria-label="Accepted" />
                            ) : (
                              <Clock className="h-4 w-4 text-[#111827]/25" aria-label="Awaiting acceptance" />
                            )
                          )}
                        </TableCell>
                        <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(p.date_created)}</TableCell>
                      </ClickableRow>
                    ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="font-utility text-sm text-[#111827]/50">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
