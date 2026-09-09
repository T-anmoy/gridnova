'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { ChevronLeft, ChevronRight, ShieldOff } from 'lucide-react'
import { useMeetings } from '@/lib/dashboard/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { MeetingSummary, Role } from '@/lib/dashboard/types'

const PAGE_SIZE = 50

function statusBadgeVariant(status: MeetingSummary['status']) {
  const map: Record<MeetingSummary['status'], 'blue' | 'green' | 'gray'> = {
    scheduled: 'blue',
    completed: 'green',
    cancelled: 'gray',
  }
  return map[status] ?? 'gray'
}

export default function MeetingsPage() {
  const router = useRouter()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useMeetings({ page, page_size: PAGE_SIZE })

  // Same restriction the backend itself enforces (engineer gets a 403 on this
  // endpoint) — matching Audit Log's conditional-render pattern rather than a
  // router.push, so a direct link still shows an honest, explicit message.
  if (role === 'engineer') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">Meetings aren&rsquo;t available to your role.</p>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Meetings</h1>
        <p className="font-utility text-sm text-[#111827]/50 mt-1">{total} total meetings</p>
      </div>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lead</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : items.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 font-utility text-[#111827]/40">
                          No meetings found
                        </TableCell>
                      </TableRow>
                    )
                  : items.map((meeting: MeetingSummary) => (
                      <TableRow
                        key={meeting.id}
                        className="cursor-pointer hover:bg-[#f7f9fc] transition-colors"
                        onClick={() => router.push(`/dashboard/leads/${meeting.lead_id}`)}
                      >
                        <TableCell className="font-utility text-sm font-medium text-[#091c3c]">
                          {meeting.customer?.name ?? '—'}
                        </TableCell>
                        <TableCell className="font-utility text-sm text-[#111827]/60">
                          {formatDatetime(meeting.scheduled_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(meeting.status)}>{meeting.status}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/leads/${meeting.lead_id}`)}
                          >
                            #{meeting.lead_id}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="font-utility text-sm text-[#111827]/50">Page {page} of {totalPages}</p>
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
