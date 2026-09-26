'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useUser } from '@clerk/nextjs'
import { AlertCircle, TrendingUp } from 'lucide-react'
import { useAnalytics } from '@/lib/dashboard/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import type { Role } from '@/lib/dashboard/types'

// Recharts (~400KB) is loaded lazily so it's not in the Analytics page's
// initial JS — it streams in behind a skeleton after the page shell renders.
const FunnelChart = dynamic(
  () => import('@/components/dashboard/analytics-charts').then((m) => m.FunnelChart),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader><CardTitle className="text-base">Lead Funnel</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[240px] w-full rounded-lg" /></CardContent>
      </Card>
    ),
  },
)

const ReportingSections = dynamic(
  () => import('@/components/dashboard/analytics-charts').then((m) => m.ReportingSections),
  {
    ssr: false,
    loading: () => (
      <div className="mt-2">
        <h2 className="font-display text-lg font-bold text-[#091c3c] mb-4">Reporting</h2>
        <Skeleton className="h-[240px] w-full rounded-lg" />
      </div>
    ),
  },
)

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-utility font-medium text-[#111827]/60 uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-display font-bold text-[#091c3c]">{value}</div>
        {sub && <p className="text-xs font-utility text-[#111827]/40 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function pct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function num(v: number | null | undefined): string {
  if (v == null) return '—'
  return String(v)
}

function cost(v: number | null | undefined): string {
  if (v == null) return '—'
  return `~$${v.toFixed(2)}`
}

function hrs(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}h`
}

export default function AnalyticsPage() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const isSales = role === 'sales'
  const canSeeReports = role === 'admin' || role === 'management'
  const employeeId = isSales ? (user?.id ?? undefined) : undefined

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const { data, isLoading, error, refetch } = useAnalytics({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    employee_id: employeeId,
  })

  // Block engineers via conditional render (not router.push)
  if (role === 'engineer') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Restricted</p>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">Analytics is not available for your role.</p>
        </div>
      </div>
    )
  }

  const funnelData = data?.funnel
    ? [
        { name: 'New', value: data.funnel.new },
        { name: 'Qualified', value: data.funnel.qualified },
        { name: 'Proposal Sent', value: data.funnel.proposal_sent },
        { name: 'Won', value: data.funnel.won },
      ]
    : []

  const allZero = data && [
    data.new_leads_count, data.ai_call_count, data.ai_estimated_cost,
  ].every((v) => !v)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#091c3c]">Analytics</h1>
          {isSales && (
            <p className="font-utility text-sm text-[#111827]/50 mt-1">Showing your metrics</p>
          )}
        </div>
        {!isSales && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[#111827]/60">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[#111827]/60">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8 text-xs" />
            </div>
          </div>
        )}
      </div>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-3 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-7 w-16" /></CardContent>
            </Card>
          ))}
        </div>
      ) : allZero ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">No data for this period</p>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">Try adjusting the date range.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard title="New Leads" value={num(data?.new_leads_count)} />
            <StatCard title="Qualification Rate" value={pct(data?.qualification_completion_rate)} />
            <StatCard title="Lead → Proposal Rate" value={pct(data?.lead_to_proposal_conversion_rate)} />
            <StatCard title="Avg Turnaround" value={hrs(data?.avg_proposal_turnaround_hours)} sub="proposal generation" />
            <StatCard title="AI Calls" value={num(data?.ai_call_count)} />
            <StatCard title="AI Est. Cost" value={cost(data?.ai_estimated_cost)} />
            <StatCard title="Escalation Rate" value={pct(data?.escalation_rate)} />
          </div>

          {/* Funnel chart (Recharts loaded lazily) */}
          {funnelData.length > 0 && <FunnelChart data={funnelData} />}
        </>
      )}

      {/* Real Reporting — admin/management only (child mounts only when allowed) */}
      {canSeeReports && (
        <div className="mt-8">
          <ReportingSections params={{ date_from: dateFrom || undefined, date_to: dateTo || undefined }} />
        </div>
      )}
    </div>
  )
}
