'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { CalendarCheck2, ChevronLeft, ChevronRight, ShieldOff } from 'lucide-react'
import { useMeetings, useEmployeeMe, useConnectCalendar } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { CalendarErrorReason, MeetingSummary, Role } from '@/lib/dashboard/types'

const PAGE_SIZE = 50

const CALENDAR_ERROR_MESSAGES: Record<CalendarErrorReason, string> = {
  invalid_state: 'The connection request expired or was tampered with — please try connecting again.',
  access_denied: 'Google Calendar access was denied.',
  consent_failed: 'Google Calendar consent could not be completed.',
  missing_code: 'Google didn’t return an authorization code — please try again.',
  not_configured: 'Google Calendar integration isn’t configured for this environment yet.',
  exchange_failed: 'Could not complete the connection with Google — please try again.',
  employee_not_found: 'Your employee record could not be matched — contact an admin.',
}

function CalendarStatusCard() {
  const { data: me, isLoading } = useEmployeeMe()
  const connectMutation = useConnectCalendar()

  async function handleConnect() {
    try {
      const result = await connectMutation.mutateAsync()
      window.location.href = result.authorization_url
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail || err.message : 'Failed to start calendar connection')
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarCheck2 className={`h-5 w-5 ${me?.google_calendar_connected ? 'text-green-600' : 'text-[#111827]/65'}`} />
          <div>
            <p className="font-utility text-sm font-medium text-[#091c3c]">
              {isLoading ? 'Checking calendar status…' : me?.google_calendar_connected ? 'Google Calendar connected' : 'Google Calendar not connected'}
            </p>
            <p className="font-utility text-xs text-[#111827]/65 mt-0.5">
              Book a Call availability comes from connected calendars — if none are connected, the public booking widget shows no slots.
            </p>
          </div>
        </div>
        {!isLoading && !me?.google_calendar_connected && (
          <Button size="sm" onClick={() => void handleConnect()} disabled={connectMutation.isPending}>
            {connectMutation.isPending ? 'Connecting…' : 'Connect Google Calendar'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function statusBadgeVariant(status: MeetingSummary['status']) {
  const map: Record<MeetingSummary['status'], 'blue' | 'green' | 'gray'> = {
    scheduled: 'blue',
    completed: 'green',
    cancelled: 'gray',
  }
  return map[status] ?? 'gray'
}

// Google's OAuth redirect lands back here with `?calendar=connected` or
// `?calendar=error&reason=…` — surface it once, then clean the query string
// so a refresh doesn't re-show the same toast. Isolated into its own
// component (rather than called directly from MeetingsPage) because
// useSearchParams() opts the whole subtree into client-side rendering during
// prerendering unless it's wrapped in a Suspense boundary.
function CalendarRedirectHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const calendar = searchParams.get('calendar')
    if (!calendar) return
    if (calendar === 'connected') {
      toast.success('Google Calendar connected')
    } else if (calendar === 'error') {
      const reason = searchParams.get('reason') as CalendarErrorReason | null
      toast.error((reason && CALENDAR_ERROR_MESSAGES[reason]) || 'Could not connect Google Calendar')
    }
    router.replace('/dashboard/meetings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
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
          <ShieldOff className="h-12 w-12 text-[#111827]/65 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
          <p className="font-utility text-sm text-[#111827]/65 mt-1">Meetings aren&rsquo;t available to your role.</p>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <Suspense fallback={null}>
        <CalendarRedirectHandler />
      </Suspense>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Meetings</h1>
        <p className="font-utility text-sm text-[#111827]/65 mt-1">{total} total meetings</p>
      </div>

      <CalendarStatusCard />

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
                        <TableCell colSpan={4} className="text-center py-12 font-utility text-[#111827]/65">
                          No meetings found
                        </TableCell>
                      </TableRow>
                    )
                  : items.map((meeting: MeetingSummary) => (
                      <ClickableRow
                        key={meeting.id}
                        className="hover:bg-[#f7f9fc] transition-colors"
                        href={`/dashboard/leads/${meeting.lead_id}`}
                      >
                        <TableCell className="font-utility text-sm font-medium text-[#091c3c]">
                          <Link href={`/dashboard/leads/${meeting.lead_id}`} className="hover:underline">
                            {meeting.customer?.name ?? '—'}
                          </Link>
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
                      </ClickableRow>
                    ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="font-utility text-sm text-[#111827]/65">Page {page} of {totalPages}</p>
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
