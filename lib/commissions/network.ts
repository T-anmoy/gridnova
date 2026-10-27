import type { PermissionRule } from '@/lib/access/permissions'
import type { NetworkSummary } from './schemas'

// Reshaping of GET /dashboard/network/summary for display. Only counts (integers) are
// added or compared here; every money figure on the page is the endpoint's own string.

const TYPE_LABEL: Record<string, string> = { associate: 'Associate', preferred_associate: 'Preferred Associate' }
const CAPABILITY_LABEL: Record<string, string> = { sales: 'Sales', execution: 'Execution' }
const LEVEL_LABEL: Record<string, string> = { state_head: 'State Head', district_head: 'District Head', block: 'Block' }

const spaced = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** "Preferred Associate · State Head", "Associate · Sales". */
export function associateGroupLabel(row: { associate_type: string; capability?: string | null; level?: string | null }): string {
  const parts = [TYPE_LABEL[row.associate_type] ?? spaced(row.associate_type)]
  if (row.capability) parts.push(CAPABILITY_LABEL[row.capability] ?? spaced(row.capability))
  if (row.level) parts.push(LEVEL_LABEL[row.level] ?? spaced(row.level))
  return parts.join(' · ')
}

export interface AssociateChartRow {
  name: string
  total: number
  /** count per status, e.g. { active: 7, suspended: 2 } */
  byStatus: Record<string, number>
}

/** One row per type/capability/level, with its count split by status. */
export function associateRows(associates: NetworkSummary['associates']): { rows: AssociateChartRow[]; statuses: string[] } {
  const map = new Map<string, AssociateChartRow>()
  const statuses: string[] = []
  for (const a of associates) {
    const name = associateGroupLabel(a)
    const row = map.get(name) ?? { name, total: 0, byStatus: {} }
    row.total += a.count
    row.byStatus[a.status] = (row.byStatus[a.status] ?? 0) + a.count
    map.set(name, row)
    if (!statuses.includes(a.status)) statuses.push(a.status)
  }
  return { rows: [...map.values()], statuses }
}

export interface StageRow {
  stage: string
  label: string
  value: number
}

/** The onboarding funnel, in the order the endpoint sent it. */
export function stageRows(byStage: Record<string, number>): StageRow[] {
  return Object.entries(byStage).map(([stage, value]) => ({ stage, label: spaced(stage), value }))
}

/** Whole-number fill for a seat meter; a seat count of 0 is 0%, never NaN. */
export function fillPercent(held: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((held / max) * 100)))
}

export interface OverdueItem {
  key: keyof NetworkSummary['overdue']
  label: string
  count: number
  /** where the queue lives; null when this person cannot open it */
  href: string | null
}

/** The overdue counters with a link to the queue each one lives in. */
export function overdueItems(overdue: NetworkSummary['overdue'], can: (rule: PermissionRule) => boolean): OverdueItem[] {
  const payments = can('payments.view_all')
  const commissions = can('commissions.view')
  return [
    { key: 'verification_calls', label: 'Customer verification calls overdue', count: overdue.verification_calls, href: '/dashboard/onboardings?attention=1' },
    { key: 'survey_reviews', label: 'Survey reviews overdue', count: overdue.survey_reviews, href: '/dashboard/survey-reviews' },
    { key: 'payments_awaiting_verification', label: 'Payments waiting too long for verification', count: overdue.payments_awaiting_verification, href: payments ? '/dashboard/accounts' : null },
    { key: 'commission_queries', label: 'Commission queries overdue', count: overdue.commission_queries, href: commissions ? '/dashboard/commissions/queries?overdue=1' : null },
  ]
}
