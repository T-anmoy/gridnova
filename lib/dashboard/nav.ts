import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart2,
  UserCog,
  ClipboardList,
  Bot,
  Package,
  CalendarClock,
  ClipboardCheck,
  Handshake,
  ListChecks,
  ShieldAlert,
  Wrench,
  Wallet,
  Database,
  Tags,
  FileSearch,
  FilePenLine,
  Coins,
  Network,
  LifeBuoy,
  Sparkles,
  Archive,
  FileUp,
  Stamp,
  KeyRound,
  Home,
  Files,
  Contact,
  Library,
  FileSpreadsheet,
} from 'lucide-react'
import type { WorkQueues } from '@/lib/dashboard/execution-types'
import { satisfies, type PermissionRule } from '@/lib/access/permissions'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  /**
   * The permission(s) the item needs, from GET /employees/me (FE-17) — never a role name.
   * A list means "any one of these". Each is chosen so its holders in the BE-17 matrix are
   * exactly the people the page serves; the page itself checks the same rule.
   */
  needs: PermissionRule
  // The proposals pending-approval badge.
  badge?: boolean
  // A badge fed by GET /dashboard/work-queues (scoped by the backend).
  queue?: 'execution' | 'payments' | 'survey_reviews' | 'survey_corrections' | 'service_requests'
  // The second-approval inbox badge (GET /approvals?status=pending).
  approvals?: boolean
  // Studio proposals awaiting approval (GET /studio/proposals?status=pending_approval), for studio.approve.
  studioApprovals?: boolean
  // Items of one group are listed together under the group's heading.
  group?: 'studio'
}

export const NAV_GROUP_LABELS: Record<NonNullable<NavItem['group']>, string> = {
  studio: 'Proposal Studio',
}

/** Leads and proposals: everyone who sees leads — all of them, or their own and unassigned. */
export const SEES_LEADS: PermissionRule = ['leads.view_all', 'leads.view_assigned']
/** The execution workspace: every project (Admin, Management, Engineer) or every one in execution (Operations). */
export const SEES_EXECUTION: PermissionRule = ['execution.view_all', 'execution.view_in_progress']
/** A person whose permissions are all the Proposal Studio's (the Proposal Desk alone): their home is Studio Home. */
export const studioOnly = (can: (rule: PermissionRule) => boolean): boolean => can('studio.view') && !can('beyond_studio')

/** The approvals inbox: holders of any approver permission (access_control.md §5). */
export const DECIDES_APPROVALS: PermissionRule = ['staff.manage', 'commissions.rates.manage', 'commissions.process']

export const NAV_ITEMS: NavItem[] = [
  // A person who holds only the Proposal Desk's Studio permissions lands on Studio Home instead.
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, needs: 'beyond_studio' },
  // Operations and Accounts see no leads (staff_contracts.md visibility rule).
  { label: 'Leads', href: '/dashboard/leads', icon: Users, needs: SEES_LEADS },
  { label: 'Onboardings', href: '/dashboard/onboardings', icon: ListChecks, needs: 'onboardings.view' },
  { label: 'Operations', href: '/dashboard/operations', icon: Wrench, needs: SEES_EXECUTION, queue: 'execution' },
  // Every customer's payments; Sales reach their own customers' payments from the onboarding.
  { label: 'Accounts', href: '/dashboard/accounts', icon: Wallet, needs: 'payments.view_all', queue: 'payments' },
  // Commissions & payouts: Management reads; Accounts and Admin act (the screens gate each control).
  { label: 'Commissions', href: '/dashboard/commissions', icon: Coins, needs: 'commissions.view' },
  // The whole network at a glance (GET /dashboard/network/summary).
  { label: 'Network Command Centre', href: '/dashboard/network', icon: Network, needs: 'associates.network_summary.view' },
  { label: 'Survey reviews', href: '/dashboard/survey-reviews', icon: FileSearch, needs: 'surveys.view', queue: 'survey_reviews' },
  { label: 'Survey corrections', href: '/dashboard/survey-corrections', icon: FilePenLine, needs: 'surveys.view', queue: 'survey_corrections' },
  // Service requests (BE-5): read by everyone who sees project execution; only holders of
  // service_requests.handle work on them (the screens gate the controls).
  { label: 'Service requests', href: '/dashboard/service-requests', icon: LifeBuoy, needs: 'execution.view', queue: 'service_requests' },
  { label: 'Attribution Flags', href: '/dashboard/attribution-flags', icon: ShieldAlert, needs: 'associates.attribution.resolve' },
  { label: 'Meetings', href: '/dashboard/meetings', icon: CalendarClock, needs: 'meetings.view' },
  { label: 'Site Assessments', href: '/dashboard/site-assessments', icon: ClipboardCheck, needs: 'proposal_inputs.manage' },
  { label: 'Proposals', href: '/dashboard/proposals', icon: FileText, needs: SEES_LEADS, badge: true },
  // Proposal Studio (BE-18): Proposal Desk, Admin and Management. Import creates drafts (studio.edit).
  { label: 'Studio Home', href: '/dashboard/studio', icon: Home, needs: 'studio.view', group: 'studio', studioApprovals: true },
  { label: 'Studio proposals', href: '/dashboard/studio/proposals', icon: Files, needs: 'studio.view', group: 'studio' },
  { label: 'Studio customers', href: '/dashboard/studio/customers', icon: Contact, needs: 'studio.view', group: 'studio' },
  { label: 'Library', href: '/dashboard/studio/library', icon: Library, needs: 'studio.view', group: 'studio' },
  { label: 'Import', href: '/dashboard/studio/import', icon: FileSpreadsheet, needs: 'studio.edit', group: 'studio' },
  // Company-wide analytics, or your own pipeline's figures.
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart2, needs: ['analytics.view_full', 'leads.view_assigned'] },
  { label: 'Employees', href: '/dashboard/employees', icon: UserCog, needs: 'staff.manage' },
  { label: 'Approvals', href: '/dashboard/approvals', icon: Stamp, needs: DECIDES_APPROVALS, approvals: true },
  { label: 'Associate Network', href: '/dashboard/associate-network', icon: Handshake, needs: 'associates.applications.review' },
  { label: 'Data Checklist', href: '/dashboard/data-checklist', icon: Database, needs: 'placeholders.view' },
  // Admin and Management read all of it; the Network Manager the associate network's records.
  { label: 'Audit Log', href: '/dashboard/audit-log', icon: ClipboardList, needs: ['audit.view', 'audit.view_associates'] },
  // Nova Records (BE-9): every staff member asks; the backend scopes every answer.
  { label: 'Ask Nova', href: '/dashboard/nova', icon: Sparkles, needs: 'beyond_studio' },
  // Project Archive (BE-8): every staff member reads (fields are redacted by the backend); archive.manage imports.
  { label: 'Project archive', href: '/dashboard/archive', icon: Archive, needs: 'beyond_studio' },
  { label: 'Archive import', href: '/dashboard/archive/import', icon: FileUp, needs: 'archive.manage' },
  { label: 'Equipment', href: '/dashboard/equipment', icon: Package, needs: 'beyond_studio' },
  // Everyone who quotes or adjusts customer prices.
  { label: 'Price list', href: '/dashboard/price-list', icon: Tags, needs: 'leads.view_commercial' },
  { label: 'Agent Control', href: '/dashboard/agents', icon: Bot, needs: 'governance.manage' },
  // Read-only for everyone on staff (BE-17 §2); the alert-routing view is a tab of it (§6).
  { label: 'Who can do what', href: '/dashboard/access', icon: KeyRound, needs: 'any_staff' },
]

/**
 * `can` is usePermissions().can — the item shows only when the server's permissions cover it.
 * Items every staff member has are listed from the first paint, before GET /employees/me
 * answers, so the menu is never empty; nothing narrower shows on a guess.
 */
export function canSeeNavItem(item: NavItem, can: (rule: PermissionRule) => boolean): boolean {
  if (item.needs === 'any_staff') return true
  // Everyone's items, except for a person who holds only the Proposal Desk's Studio permissions
  // (so they also show before the server has answered).
  if (item.needs === 'beyond_studio') return !studioOnly(can)
  return can(item.needs)
}

/** The menu for a set of granted permission ids (pure — used by tests and the command palette). */
export const visibleNavItems = (granted: readonly string[] | ReadonlySet<string>): NavItem[] => {
  const set = new Set(granted)
  return NAV_ITEMS.filter((i) => canSeeNavItem(i, (rule) => satisfies(set, rule)))
}

/**
 * Attention count for a nav badge. Execution and payments sum every counter in
 * the role's response. Survey reviews count only `awaiting`: `overdue` is
 * already inside it, so adding both would count an overdue survey twice.
 */
export function queueBadgeCount(queue: NonNullable<NavItem['queue']>, queues: WorkQueues | undefined): number {
  if (queue === 'survey_reviews') return queues?.survey_reviews?.awaiting ?? 0
  if (queue === 'survey_corrections') return queues?.survey_corrections?.pending ?? 0
  // `overdue` is a subset of `open`, so adding both would count an overdue request twice.
  if (queue === 'service_requests') return queues?.service_requests?.open ?? 0
  const q = queues?.[queue]
  return q ? Object.values(q).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0) : 0
}

/** Overdue surveys (a subset of the awaiting count) for the second badge. */
export function overdueSurveyCount(queues: WorkQueues | undefined): number {
  return queues?.survey_reviews?.overdue ?? 0
}

/** Overdue service requests (a subset of the open count) for the second badge. */
export function overdueServiceRequestCount(queues: WorkQueues | undefined): number {
  return queues?.service_requests?.overdue ?? 0
}
