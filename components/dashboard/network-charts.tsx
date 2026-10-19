'use client'

// Recharts is loaded through next/dynamic from NetworkCommandCentre, so the chart library stays
// out of every other dashboard page. Animation is off: recharts 3.10 under React 19.2 renders
// empty shapes otherwise (see analytics-charts.tsx). Each chart is a labelled figure with a
// data table behind a <details>, so the numbers are readable without the picture.

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AssociateChartRow, StageRow } from '@/lib/commissions/network'

const AXIS_TICK = { fontFamily: 'IBM Plex Sans', fontSize: 12, fill: '#111827' } as const
const TOOLTIP_STYLE = { fontFamily: 'IBM Plex Sans', fontSize: 12, borderColor: '#e4e8ee' } as const
const STATUS_COLOR: Record<string, string> = { active: '#0e2a63', suspended: '#f7a800', deactivated: '#9aa3b2' }
const FALLBACK_COLOR = '#2f5daa'

function ChartShell({ title, summary, height, table, children }: { title: string; summary: string; height: number; table: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <figure>
          <div role="img" aria-label={summary} style={{ height }}>
            {children}
          </div>
          <figcaption className="sr-only">{summary}</figcaption>
        </figure>
        <details className="mt-3">
          <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-medium text-[#0e2a63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]">Show the numbers</summary>
          {table}
        </details>
      </CardContent>
    </Card>
  )
}

export function OnboardingFunnelChart({ rows }: { rows: StageRow[] }) {
  const summary = rows.length ? `Active customer onboardings by current stage: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}.` : 'No active onboardings.'
  const height = Math.max(160, rows.length * 34 + 40)
  return (
    <ChartShell
      title="Onboarding funnel"
      summary={summary}
      height={height}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Active onboardings by current stage</caption>
          <thead><tr className="text-left text-xs text-gray-500"><th scope="col" className="py-1">Stage</th><th scope="col" className="py-1 text-right">Customers</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.stage} className="border-t border-[#e4e8ee]"><th scope="row" className="py-1 text-left font-normal">{r.label}</th><td className="py-1 text-right">{r.value}</td></tr>)}</tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e8ee" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
          <YAxis type="category" dataKey="label" width={130} tick={AXIS_TICK} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" name="Customers" fill="#f7a800" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function AssociatesChart({ rows, statuses }: { rows: AssociateChartRow[]; statuses: string[] }) {
  const data = rows.map((r) => ({ name: r.name, ...r.byStatus }))
  const summary = rows.length ? `Associates by type and status: ${rows.map((r) => `${r.name} ${r.total}`).join(', ')}.` : 'No associates.'
  const height = Math.max(160, rows.length * 44 + 70)
  return (
    <ChartShell
      title="Associates by type and status"
      summary={summary}
      height={height}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Associates by type and status</caption>
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th scope="col" className="py-1">Type</th>
              {statuses.map((s) => <th key={s} scope="col" className="py-1 text-right capitalize">{s}</th>)}
              <th scope="col" className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-[#e4e8ee]">
                <th scope="row" className="py-1 text-left font-normal">{r.name}</th>
                {statuses.map((s) => <td key={s} className="py-1 text-right">{r.byStatus[s] ?? 0}</td>)}
                <td className="py-1 text-right font-medium">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e8ee" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
          <YAxis type="category" dataKey="name" width={150} tick={AXIS_TICK} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontFamily: 'IBM Plex Sans', fontSize: 12 }} />
          {statuses.map((s) => (
            <Bar key={s} dataKey={s} name={s} stackId="a" fill={STATUS_COLOR[s] ?? FALLBACK_COLOR} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
