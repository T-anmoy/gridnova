'use client'

// All Recharts-dependent chart rendering for the Analytics page lives here so
// it can be loaded via next/dynamic — keeping the ~400KB chart library out of
// the initial JS for staff who land on other dashboard pages first.
//
// Every Bar/Line below sets isAnimationActive={false} — with it left on,
// recharts 3.10.1's growth animation silently fails against this app's React
// 19.2.4 (a documented recharts/React-19.2 incompatibility in the animation
// engine: https://github.com/recharts/recharts/issues/6857), leaving every
// shape's own inner render permanently empty — axes and legend draw, but no
// bar or line ever appears, in dev AND production, at any viewport width.
// Disabling the animation bypasses the broken code path entirely.

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import { AlertCircle, TrendingUp } from 'lucide-react'
import {
  useConversionBySource, useDealSizeByTier, useRepPerformance, usePipelineTrend,
} from '@/lib/dashboard/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  conversionChartData, dealSizeChartData, pipelineChartData,
} from '@/lib/dashboard/analytics-transform'
import { formatCurrency } from '@/lib/dashboard/utils'
import type { AnalyticsParams } from '@/lib/dashboard/types'

const CHART_AXIS_TICK = { fontFamily: 'IBM Plex Sans', fontSize: 12, fill: '#111827' } as const
const CHART_TOOLTIP_STYLE = { fontFamily: 'IBM Plex Sans', fontSize: 12, borderColor: '#e4e8ee' } as const

function num(v: number | null | undefined): string {
  return v == null ? '—' : String(v)
}
function hrs(v: number | null | undefined): string {
  return v == null ? '—' : `${v.toFixed(1)}h`
}

export function FunnelChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Lead Funnel</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e8ee" />
            <XAxis dataKey="name" tick={CHART_AXIS_TICK} />
            <YAxis tick={CHART_AXIS_TICK} />
            <RechartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="value" fill="#f7a800" radius={[4, 4, 0, 0]} name="Count" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Shared loading / error / empty wrapper for a reporting section.
function ChartFrame({
  title, isLoading, error, onRetry, isEmpty, children,
}: {
  title: string
  isLoading: boolean
  error: unknown
  onRetry: () => void
  isEmpty?: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="mb-6">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-utility font-medium text-red-700">Failed to load {title.toLowerCase()}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
            </div>
          </div>
        ) : isLoading ? (
          <Skeleton className="h-[240px] w-full rounded-lg" />
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-10 w-10 text-[#111827]/65 mb-3" />
            <p className="font-utility text-sm text-[#111827]/65">No data for this period</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export function ReportingSections({ params }: { params: AnalyticsParams }) {
  const conversion = useConversionBySource(params)
  const dealSize = useDealSizeByTier(params)
  const reps = useRepPerformance(params)
  const trend = usePipelineTrend(params)

  const conversionData = conversionChartData(conversion.data)
  const dealSizeData = dealSizeChartData(dealSize.data)
  const pipelineData = pipelineChartData(trend.data)

  return (
    <div className="mt-2">
      <h2 className="font-display text-lg font-bold text-[#091c3c] mb-4">Reporting</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Conversion Rate by Source"
          isLoading={conversion.isLoading}
          error={conversion.error}
          onRetry={() => void conversion.refetch()}
          isEmpty={conversionData.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={conversionData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e8ee" />
              <XAxis dataKey="name" tick={CHART_AXIS_TICK} />
              <YAxis unit="%" tick={CHART_AXIS_TICK} />
              <RechartTooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [`${Number(value)}%`, 'Conversion']} />
              <Bar dataKey="rate" fill="#f7a800" radius={[4, 4, 0, 0]} name="Conversion rate" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="Deal Size by Capacity Tier"
          isLoading={dealSize.isLoading}
          error={dealSize.error}
          onRetry={() => void dealSize.refetch()}
          isEmpty={dealSizeData.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dealSizeData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e8ee" />
              <XAxis dataKey="name" tick={CHART_AXIS_TICK} />
              <YAxis tick={CHART_AXIS_TICK} />
              <RechartTooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
              <Legend wrapperStyle={{ fontFamily: 'IBM Plex Sans', fontSize: 12 }} />
              <Bar dataKey="avg" fill="#f7a800" radius={[4, 4, 0, 0]} name="Avg deal size" isAnimationActive={false} />
              <Bar dataKey="total" fill="#0e2a63" radius={[4, 4, 0, 0]} name="Total deal size" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <ChartFrame
        title="Pipeline Trend — Leads vs. Proposals Won"
        isLoading={trend.isLoading}
        error={trend.error}
        onRetry={() => void trend.refetch()}
        isEmpty={pipelineData.length === 0}
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={pipelineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e8ee" />
            <XAxis dataKey="name" tick={CHART_AXIS_TICK} />
            <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} />
            <RechartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontFamily: 'IBM Plex Sans', fontSize: 12 }} />
            <Line type="monotone" dataKey="leads" stroke="#0e2a63" strokeWidth={2} dot={false} name="Leads created" isAnimationActive={false} />
            <Line type="monotone" dataKey="won" stroke="#f7a800" strokeWidth={2} dot={false} name="Proposals won" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Rep Performance"
        isLoading={reps.isLoading}
        error={reps.error}
        onRetry={() => void reps.refetch()}
        isEmpty={(reps.data?.length ?? 0) === 0}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Leads Handled</TableHead>
                <TableHead className="text-right">Proposals Drafted</TableHead>
                <TableHead className="text-right">Proposals Won</TableHead>
                <TableHead className="text-right">Avg Time to Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reps.data?.map((r) => (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-utility text-sm font-medium text-[#091c3c]">{r.name}</TableCell>
                  <TableCell className="text-right font-utility text-sm text-[#111827]/70">{num(r.leads_handled)}</TableCell>
                  <TableCell className="text-right font-utility text-sm text-[#111827]/70">{num(r.proposals_drafted)}</TableCell>
                  <TableCell className="text-right font-utility text-sm text-[#111827]/70">{num(r.proposals_won)}</TableCell>
                  <TableCell className="text-right font-utility text-sm text-[#111827]/70">{hrs(r.avg_time_to_close_hours)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ChartFrame>
    </div>
  )
}
