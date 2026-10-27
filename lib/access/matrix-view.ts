import type { AccessMatrix, AccessPermission, AccessRole } from './types'

// Shapes GET /access/matrix for the read-only "Who can do what" page: permissions grouped
// by area (the same sections as the backend's config), searchable by words.

const AREAS: { label: string; prefixes: string[] }[] = [
  { label: 'Leads', prefixes: ['leads'] },
  { label: 'Proposals and pricing', prefixes: ['proposals', 'proposal_inputs', 'pricing'] },
  { label: 'Customers, meetings and analytics', prefixes: ['customers', 'meetings', 'projects', 'analytics'] },
  { label: 'Associate network and surveys', prefixes: ['associates', 'territories', 'onboardings', 'surveys'] },
  { label: 'Execution and service', prefixes: ['execution', 'service_requests'] },
  { label: 'Money', prefixes: ['payments', 'commissions', 'payouts'] },
  { label: 'Company setup and oversight', prefixes: ['equipment', 'placeholders', 'archive', 'governance', 'records', 'audit', 'staff'] },
]

export function areaOf(permissionId: string): string {
  const prefix = permissionId.split('.')[0]
  return AREAS.find((a) => a.prefixes.includes(prefix))?.label ?? 'Other'
}

export interface MatrixGroup {
  area: string
  permissions: AccessPermission[]
}

/** Permissions grouped by area, in area order; `query` matches words in the id, description or a holder's role label. */
export function groupMatrix(matrix: AccessMatrix, query = '', roleFilter: string | null = null): MatrixGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const holders = (p: AccessPermission) => matrix.roles.filter((r) => r.permissions.includes(p.id))
  const matches = (p: AccessPermission) => {
    if (roleFilter && !holders(p).some((r) => r.id === roleFilter)) return false
    if (!words.length) return true
    const hay = `${p.id.replace(/[._]/g, ' ')} ${p.description} ${holders(p).map((r) => r.label).join(' ')}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  }
  const order = [...AREAS.map((a) => a.label), 'Other']
  const groups = new Map<string, AccessPermission[]>()
  for (const p of matrix.permissions) {
    if (!matches(p)) continue
    const area = areaOf(p.id)
    groups.set(area, [...(groups.get(area) ?? []), p])
  }
  return order.filter((a) => groups.has(a)).map((area) => ({ area, permissions: groups.get(area)! }))
}

export const holds = (role: AccessRole, permissionId: string) => role.permissions.includes(permissionId)
