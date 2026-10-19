'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import {
  CheckCircle,
  Users,
  FileText,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  MessageSquare,
  Send,
  Activity,
} from 'lucide-react'
import { useOverviewStats, useActivityFeed } from '@/lib/dashboard/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { formatTimeAgo, formatLongDate, getISTHour } from '@/lib/dashboard/utils'
import type { ActivityItem, StatTrend, Role } from '@/lib/dashboard/types'

// ── Stat card ─────────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: StatTrend }) {
  if (trend === 0) {
    return <span className="text-xs font-utility text-[#111827]/65">— vs yesterday</span>
  }
  const up = trend > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-utility ${up ? 'text-[#8a5a00]' : 'text-[#111827]/65'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{trend} vs yesterday
    </span>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  color = 'gold',
  trend,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  href: string
  color?: 'gold' | 'navy' | 'amber'
  trend?: StatTrend
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
          <div className="mt-1 min-h-[1.25rem]">
            {trend ? (
              <TrendBadge trend={trend} />
            ) : (
              <p className="text-xs font-utility text-[#111827]/65 group-hover:text-[#8a5a00] transition-colors">
                View details →
              </p>
            )}
          </div>
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

// ── Activity feed ─────────────────────────────────────────────────────────────

// Keyed by the audit `action` value (e.g. "created", "status_changed_to_qualified",
// "sent") — matches app/memory's audit action names, not a separate "event type".
const EVENT_ICON: Record<string, React.ElementType> = {
  created: Users,
  sent: Send,
  approved: CheckCircle,
  accepted: CheckCircle,
  note_added: MessageSquare,
}

function activityIcon(item: ActivityItem): React.ReactNode {
  const Icon = item.action.startsWith('status_changed_to_')
    ? ArrowRight
    : (EVENT_ICON[item.action] ?? Activity)
  return <Icon className="h-3.5 w-3.5 text-[#f7a800]" />
}

function activityLink(item: ActivityItem): string | null {
  if (item.entity_type === 'lead') return `/dashboard/leads/${item.entity_id}`
  if (item.entity_type === 'proposal') return `/dashboard/proposals/${item.entity_id}`
  return null
}

// The backend's `description` is already a complete sentence that includes the
// entity reference (e.g. "Lead #12 status changed by Priya") — so unlike a
// typical activity feed, no separate "#id" link is appended after it; the
// whole row links through instead, when the entity type supports navigation.
function ActivityRow({ item }: { item: ActivityItem }) {
  const link = activityLink(item)
  const body = (
    <>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7a800]/10">
        {activityIcon(item)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-utility text-sm text-[#111827]/80 leading-snug">{item.description}</p>
        <p className="mt-0.5 font-utility text-xs text-[#111827]/65">
          {item.actor ? `${item.actor} · ` : ''}{formatTimeAgo(item.created_at)}
        </p>
      </div>
    </>
  )

  if (link) {
    return (
      <Link href={link} className="flex items-start gap-3 py-3 border-b border-[#e4e8ee] last:border-0 -mx-1 px-1 rounded-lg hover:bg-[#f7a800]/5 transition-colors">
        {body}
      </Link>
    )
  }
  return <div className="flex items-start gap-3 py-3 border-b border-[#e4e8ee] last:border-0">{body}</div>
}

function ActivityFeedSection() {
  const { data: activity, isLoading, error } = useActivityFeed()

  return (
    <div className="mt-8">
      <h2 className="font-display text-lg font-semibold text-[#091c3c] mb-4">Recent Activity</h2>
      {isLoading ? (
        <Card>
          <CardContent className="pt-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <p className="font-utility text-sm text-[#111827]/65">Activity feed unavailable.</p>
      ) : (activity ?? []).length === 0 ? (
        <p className="font-utility text-sm text-[#111827]/65">No recent activity.</p>
      ) : (
        <Card>
          <CardContent className="pt-2 pb-0">
            {(activity ?? []).map((item, i) => (
              <ActivityRow key={`${item.entity_type}-${item.entity_id}-${item.action}-${item.created_at}-${i}`} item={item} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Overview page ─────────────────────────────────────────────────────────────

export default function DashboardOverview() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const { data: stats, isLoading, error, refetch } = useOverviewStats()

  const showManagerCard = role === 'admin' || role === 'management'

  const allZero =
    stats &&
    stats.new_leads_today === 0 &&
    stats.follow_ups_due === 0 &&
    stats.pending_approval === 0 &&
    (!showManagerCard || stats.pending_manager_signoff === 0)

  if (error) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c] mb-6">Overview</h1>
        <DashboardError error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">
          Good {getGreeting()}, {user?.firstName ?? 'there'}
        </h1>
        <p className="font-utility text-sm text-[#111827]/65 mt-1">
          {formatLongDate()}
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
          <p className="font-utility text-sm text-[#111827]/65 mt-2">No pending actions at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="New Leads Today"
            value={stats?.new_leads_today ?? 0}
            icon={Users}
            href="/dashboard/leads"
            color="navy"
            trend={stats?.trends?.new_leads_today}
          />
          <StatCard
            title="Follow-ups Due"
            value={stats?.follow_ups_due ?? 0}
            icon={Clock}
            href="/dashboard/leads?pipeline_stage=qualifying"
            color="gold"
            trend={stats?.trends?.follow_ups_due}
          />
          <StatCard
            title="Pending Approval"
            value={stats?.pending_approval ?? 0}
            icon={FileText}
            href="/dashboard/proposals?status=pending_approval"
            color="amber"
            trend={stats?.trends?.pending_approval}
          />
          {showManagerCard && (
            <StatCard
              title="Pending Manager Sign-Off"
              value={stats?.pending_manager_signoff ?? 0}
              icon={AlertCircle}
              href="/dashboard/proposals?status=pending_approval"
              color="amber"
              trend={stats?.trends?.pending_manager_signoff}
            />
          )}
        </div>
      )}

      <ActivityFeedSection />
    </div>
  )
}

function getGreeting() {
  const hour = getISTHour()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
