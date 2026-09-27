'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { ShieldOff } from 'lucide-react'
import { useAssociateApplications } from '@/lib/associate/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/dashboard/utils'
import type { ApplicationStatus, ApplicationType } from '@/lib/associate/types'
import type { Role } from '@/lib/dashboard/types'

const STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'needs_info', 'rejected', 'approved']

function statusVariant(status: ApplicationStatus) {
  const map: Record<ApplicationStatus, string> = {
    submitted: 'blue',
    under_review: 'amber',
    needs_info: 'orange',
    rejected: 'gray',
    approved: 'green',
  }
  return (map[status] ?? 'gray') as 'blue' | 'amber' | 'orange' | 'gray' | 'green'
}

function territoryLabel(t: { state: { name: string }; district: { name: string } | null; block: { name: string } | null }) {
  return [t.state.name, t.district?.name, t.block?.name].filter(Boolean).join(' / ')
}

export default function AssociateNetworkPage() {
  const router = useRouter()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const [typeFilter, setTypeFilter] = useState<ApplicationType | ''>('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useAssociateApplications({
    application_type: typeFilter || undefined,
    status: statusFilter || undefined,
    page,
    page_size: 25,
  })

  if (role && role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">Only administrators can manage the Associate Network.</p>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Associate Network</h1>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">{data?.total ?? 0} applications</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/associate-network/associates" className="btn-text font-utility text-sm text-[#0e2a63]">Associates →</Link>
          <Link href="/dashboard/associate-network/territories" className="btn-text font-utility text-sm text-[#0e2a63]">Territories & seats →</Link>
        </div>
      </div>

      <Card className="mb-4">
        <div className="p-4 flex flex-wrap gap-3">
          <Select value={typeFilter || 'all'} onValueChange={(v) => { setPage(1); setTypeFilter(v === 'all' ? '' : (v as ApplicationType)) }}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="associate">Associate</SelectItem>
              <SelectItem value="preferred_associate">Preferred Associate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter || 'all'} onValueChange={(v) => { setPage(1); setStatusFilter(v === 'all' ? '' : (v as ApplicationStatus)) }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
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
                <TableHead>Applicant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 font-utility text-[#111827]/40">
                        No applications found
                      </TableCell>
                    </TableRow>
                  )
                : items.map((app) => (
                    <TableRow
                      key={`${app.application_type}-${app.application_id}`}
                      className="cursor-pointer hover:bg-[#f7f9fc] transition-colors"
                      onClick={() => router.push(`/dashboard/associate-network/${app.application_type}/${app.application_id}`)}
                    >
                      <TableCell>
                        <p className="font-utility font-medium text-[#091c3c]">{app.full_name}</p>
                        <p className="font-utility text-xs text-[#111827]/50">{app.mobile}</p>
                      </TableCell>
                      <TableCell className="font-utility text-sm">
                        {app.application_type === 'preferred_associate' ? 'Preferred Associate' : 'Associate'}
                        {app.capability && <span className="text-[#111827]/40"> · {app.capability}</span>}
                        {app.requested_level && <span className="text-[#111827]/40"> · {app.requested_level.replace(/_/g, ' ')}</span>}
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">
                        {territoryLabel(app.requested_territory ?? app.address_territory)}
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(app.status)}>{app.status.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(app.submitted_at)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {data && data.total > data.page_size && (
            <div className="flex items-center justify-between p-4 border-t border-[#e4e8ee]">
              <button
                className="font-utility text-sm text-[#0e2a63] disabled:opacity-30"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span className="font-utility text-xs text-[#111827]/50">Page {page} of {totalPages}</span>
              <button
                className="font-utility text-sm text-[#0e2a63] disabled:opacity-30"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
