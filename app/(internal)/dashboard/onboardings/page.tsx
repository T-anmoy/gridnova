'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStaffOnboardings } from '@/lib/dashboard/onboarding-api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FormalProposalBlockedBadge } from '@/components/dashboard/FormalProposalBlocked'
import { formatDate } from '@/lib/dashboard/utils'
import type { OnboardingStatus } from '@/lib/associate/onboarding-types'

const STATUSES: OnboardingStatus[] = ['draft', 'submitted', 'verified', 'closed']

function bandVariant(band: 'hot' | 'warm' | 'cold') {
  return band === 'hot' ? 'gold' : band === 'warm' ? 'amber' : 'blue'
}

export default function OnboardingsListPage() {
  const router = useRouter()
  const [status, setStatus] = useState<OnboardingStatus | ''>('')
  const [needsAttention, setNeedsAttention] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useStaffOnboardings({
    status: status || undefined,
    needs_attention: needsAttention || undefined,
    page,
    page_size: 25,
  })

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#091c3c]">Onboardings</h1>
      </div>

      <div className="flex items-center gap-3">
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : (v as OnboardingStatus))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={needsAttention ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setNeedsAttention((v) => !v)
            setPage(1)
          }}
        >
          Needs attention
        </Button>
      </div>

      {error && <DashboardError error={error} onRetry={() => void refetch()} />}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Associate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((o) => (
                  <TableRow
                    key={o.onboarding_id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/onboardings/${o.onboarding_id}`)}
                  >
                    <TableCell>
                      <p className="font-medium">{o.customer.name}</p>
                      <p className="text-xs text-gray-500">{o.customer.mobile}</p>
                    </TableCell>
                    <TableCell>{o.owner.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="gray">{o.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {o.score && <Badge variant={bandVariant(o.score.band)}>{o.score.band}</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {o.formal_proposal_blocked && <FormalProposalBlockedBadge blocked={o.formal_proposal_blocked} />}
                        {o.attribution.under_review && (
                          <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
                            Attribution review
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(o.created_at)}</TableCell>
                  </TableRow>
                ))}
                {data && data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                      No onboardings match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <p className="text-sm text-gray-500">
            Page {data.page} of {Math.ceil(data.total / data.page_size)}
          </p>
          <Button variant="outline" size="sm" disabled={page * data.page_size >= data.total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
