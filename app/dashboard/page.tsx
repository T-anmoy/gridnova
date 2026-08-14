'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { CheckCircle, Users, FileText, Clock, AlertCircle } from 'lucide-react'
import { useLeads, useProposals } from '@/lib/dashboard/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import type { Role } from '@/lib/dashboard/types'

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  color = 'gold',
}: {
  title: string
  value: number | string
  icon: React.ElementType
  href: string
  color?: 'gold' | 'navy' | 'amber'
}) {
  const colorMap = {
    gold: 'bg-[#f7a800]/10 text-[#f7a800]',
    navy: 'bg-[#091c3c]/10 text-[#091c3c]',
    amber: 'bg-amber-100 text-amber-700',
  }

  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-utility font-medium text-[#111827]/65">{title}</CardTitle>
            <div className={`rounded-lg p-2 ${colorMap[color]}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-[#091c3c]">{value}</div>
          <p className="text-xs font-utility text-[#111827]/40 mt-1 group-hover:text-[#f7a800] transition-colors">
            View details →
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  )
}

export default function DashboardOverview() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const today = new Date().toISOString().split('T')[0]

  const { data: leadsData, isLoading: leadsLoading, error: leadsError, refetch: refetchLeads } = useLeads()
  const { data: pendingApproval, isLoading: pendingLoading, error: pendingError, refetch: refetchPending } = useProposals({
    status: 'pending_approval',
    page_size: 200,
  })

  const isLoading = leadsLoading || pendingLoading
  const hasError = leadsError || pendingError

  // Count leads created today
  const newLeadsToday = leadsData?.filter((l) => {
    const leadDate = l.created_at?.split('T')[0]
    return leadDate === today
  }).length ?? 0

  // Count qualifying leads as "follow-ups due"
  const followUpsDue = leadsData?.filter((l) => l.pipeline_stage === 'qualifying').length ?? 0

  // Pending proposals split
  const allPending = pendingApproval?.items ?? []
  const pendingStandard = allPending.filter((p) => !p.requires_manager_signoff).length
  const pendingManagerSignoff = allPending.filter((p) => p.requires_manager_signoff).length

  const showManagerCard = role === 'admin' || role === 'management'

  const allZero =
    newLeadsToday === 0 &&
    followUpsDue === 0 &&
    pendingStandard === 0 &&
    (!showManagerCard || pendingManagerSignoff === 0)

  if (hasError) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c] mb-6">Overview</h1>
        <DashboardError
          error={leadsError ?? pendingError}
          onRetry={() => { void refetchLeads(); void refetchPending() }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">
          Good {getGreeting()}, {user?.firstName ?? 'there'}
        </h1>
        <p className="font-utility text-sm text-[#111827]/50 mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          {showManagerCard && <StatCardSkeleton />}
        </div>
      ) : allZero ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f7a800]/10">
            <CheckCircle className="h-8 w-8 text-[#f7a800]" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#091c3c]">You&rsquo;re all caught up</h2>
          <p className="font-utility text-sm text-[#111827]/50 mt-2">No pending actions at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="New Leads Today"
            value={newLeadsToday}
            icon={Users}
            href="/dashboard/leads"
            color="navy"
          />
          <StatCard
            title="Follow-ups Due"
            value={followUpsDue}
            icon={Clock}
            href="/dashboard/leads?pipeline_stage=qualifying"
            color="gold"
          />
          <StatCard
            title="Pending Approval"
            value={pendingStandard}
            icon={FileText}
            href="/dashboard/proposals?status=pending_approval"
            color="amber"
          />
          {showManagerCard && (
            <StatCard
              title="Pending Manager Sign-Off"
              value={pendingManagerSignoff}
              icon={AlertCircle}
              href="/dashboard/proposals?status=pending_approval"
              color="amber"
            />
          )}
        </div>
      )}
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
