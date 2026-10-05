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
} from 'lucide-react'
import type { Role } from '@/lib/dashboard/types'
import type { WorkQueues } from '@/lib/dashboard/execution-types'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: Role[] | 'all'
  // The proposals pending-approval badge.
  badge?: boolean
  // A badge fed by GET /dashboard/work-queues (role-scoped by the backend).
  queue?: 'execution' | 'payments'
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, roles: 'all' },
  { label: 'Leads', href: '/dashboard/leads', icon: Users, roles: 'all' },
  { label: 'Onboardings', href: '/dashboard/onboardings', icon: ListChecks, roles: ['admin', 'sales', 'management'] },
  { label: 'Operations', href: '/dashboard/operations', icon: Wrench, roles: ['admin', 'management', 'engineer', 'operations'], queue: 'execution' },
  { label: 'Accounts', href: '/dashboard/accounts', icon: Wallet, roles: ['admin', 'management', 'accounts'], queue: 'payments' },
  { label: 'Attribution Flags', href: '/dashboard/attribution-flags', icon: ShieldAlert, roles: ['admin'] },
  { label: 'Meetings', href: '/dashboard/meetings', icon: CalendarClock, roles: ['admin', 'sales', 'management'] },
  { label: 'Site Assessments', href: '/dashboard/site-assessments', icon: ClipboardCheck, roles: ['admin', 'sales'] },
  { label: 'Proposals', href: '/dashboard/proposals', icon: FileText, roles: ['admin', 'sales', 'management', 'engineer'], badge: true },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart2, roles: ['admin', 'sales', 'management'] },
  { label: 'Employees', href: '/dashboard/employees', icon: UserCog, roles: ['admin'] },
  { label: 'Associate Network', href: '/dashboard/associate-network', icon: Handshake, roles: ['admin'] },
  { label: 'Data Checklist', href: '/dashboard/data-checklist', icon: Database, roles: ['admin', 'management'] },
  { label: 'Audit Log', href: '/dashboard/audit-log', icon: ClipboardList, roles: ['admin', 'management'] },
  { label: 'Equipment', href: '/dashboard/equipment', icon: Package, roles: 'all' },
  { label: 'Agent Control', href: '/dashboard/agents', icon: Bot, roles: ['admin'] },
]

export function canSeeNavItem(item: NavItem, role: Role | undefined): boolean {
  if (item.roles === 'all') return true
  if (!role) return false
  return item.roles.includes(role)
}

export const visibleNavItems = (role: Role | undefined): NavItem[] => NAV_ITEMS.filter((i) => canSeeNavItem(i, role))

/** Attention count for a nav badge — the sum of every queue the role's response contains. */
export function queueBadgeCount(queue: 'execution' | 'payments', queues: WorkQueues | undefined): number {
  const q = queues?.[queue]
  return q ? Object.values(q).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0) : 0
}
