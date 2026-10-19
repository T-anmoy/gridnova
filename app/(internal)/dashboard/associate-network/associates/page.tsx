'use client'

import { Suspense } from 'react'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ShieldOff } from 'lucide-react'
import { useAdminAssociates } from '@/lib/associate/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AssociateStatus } from '@/lib/associate/types'
import type { Role } from '@/lib/dashboard/types'

const STATUSES: AssociateStatus[] = ['active', 'suspended', 'deactivated']

function statusVariant(status: AssociateStatus) {
  const map: Record<AssociateStatus, 'green' | 'amber' | 'gray'> = { active: 'green', suspended: 'amber', deactivated: 'gray' }
  return map[status]
}

export default function AssociatesListPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AssociatesList />
    </Suspense>
  )
}

function AssociatesList() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined
  // The status filter lives in the URL (?status=…).
  const url = useUrlParams()
  const statusFilter = url.get('status') as AssociateStatus | ''

  const { data, isLoading, error, refetch } = useAdminAssociates({ status: statusFilter || undefined, page_size: 50 })

  if (role && role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/65 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Associates</h1>
          <p className="font-utility text-sm text-[#111827]/65 mt-1">{data?.total ?? 0} associates</p>
        </div>
        <Link href="/dashboard/associate-network" className="btn-text font-utility text-sm text-[#0e2a63]">← Applications</Link>
      </div>

      <Card className="mb-4">
        <div className="p-4">
          <Select value={statusFilter || 'all'} onValueChange={(v) => url.set({ status: v === 'all' ? undefined : v })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
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
                <TableHead>Associate ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Status</TableHead>
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
                      <TableCell colSpan={5} className="text-center py-12 font-utility text-[#111827]/65">No associates found</TableCell>
                    </TableRow>
                  )
                : items.map((a) => (
                    <ClickableRow
                      key={a.associate_id}
                      className="hover:bg-[#f7f9fc] transition-colors"
                      href={`/dashboard/associate-network/associates/${a.associate_id}`}
                    >
                      <TableCell className="font-utility font-medium text-[#091c3c]">
                        <Link href={`/dashboard/associate-network/associates/${a.associate_id}`} className="hover:underline">
                          {a.associate_id}</Link>
                      </TableCell>
                      <TableCell className="font-utility text-sm">{a.full_name}</TableCell>
                      <TableCell className="font-utility text-sm">
                        {a.associate_type === 'preferred_associate' ? 'Preferred' : 'Associate'}
                        {a.level && <span className="text-[#111827]/65"> · {a.level.replace(/_/g, ' ')}</span>}
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{a.territory ?? '—'}</TableCell>
                      <TableCell><Badge variant={statusVariant(a.status)}>{a.status}</Badge></TableCell>
                    </ClickableRow>
                  ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
