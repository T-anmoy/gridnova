import type {
  ConversionBySource,
  DealSizeByTier,
  PipelineTrendPoint,
} from './types'

// Pure data-shaping for the Recharts series on the Analytics page. Kept out of
// the component so the mapping (null handling, percentage scaling, week labels)
// is unit-testable in isolation.

export interface ConversionDatum {
  name: string
  rate: number // percentage, 0..100
}

export function conversionChartData(rows: ConversionBySource[] | undefined): ConversionDatum[] {
  if (!rows) return []
  return rows.map((r) => ({
    name: r.source,
    rate: r.conversion_rate == null ? 0 : Number((r.conversion_rate * 100).toFixed(1)),
  }))
}

export interface DealSizeDatum {
  name: string
  avg: number
  total: number
}

export function dealSizeChartData(rows: DealSizeByTier[] | undefined): DealSizeDatum[] {
  if (!rows) return []
  return rows.map((r) => ({
    name: r.tier,
    avg: r.avg_deal_size ?? 0,
    total: r.total_deal_size ?? 0,
  }))
}

export interface PipelineDatum {
  name: string
  leads: number
  won: number
}

// Format an ISO week-start date to a short "d MMM" label; pass through any
// non-date string unchanged (backend may already send a label).
export function weekLabel(week: string): string {
  const d = new Date(week)
  if (Number.isNaN(d.getTime())) return week
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d)
}

export function pipelineChartData(rows: PipelineTrendPoint[] | undefined): PipelineDatum[] {
  if (!rows) return []
  return rows.map((r) => ({
    name: weekLabel(r.week),
    leads: r.leads_created,
    won: r.proposals_won,
  }))
}
