import type { Role } from '@/lib/dashboard/types'
import type { AccessMatrix } from './types'

// The ONE file that names roles. It labels them for display — it never decides what a
// person may do (that is `permissions` from GET /employees/me). The role-literal scan
// (tests/unit/fe17-role-literal-scan.test.ts) fails on a role name anywhere else in the
// dashboard code.
//
// GET /access/matrix carries each role's own label and description; these are the
// fallback while it loads (and for a role the matrix does not list yet).
const FALLBACK_LABELS: Record<Role, string> = {
  admin: 'Admin',
  management: 'Management',
  network_manager: 'Network Manager',
  sales: 'Sales',
  engineer: 'Engineer',
  operations: 'Operations',
  accounts: 'Accounts',
}

/** The backend's display order (access_control.md §1: the primary role is the first held in it). */
export const ROLE_ORDER: readonly Role[] = ['admin', 'management', 'network_manager', 'sales', 'engineer', 'operations', 'accounts']

export function roleLabel(role: string, matrix?: AccessMatrix | null): string {
  const fromMatrix = matrix?.roles.find((r) => r.id === role)?.label
  if (fromMatrix) return fromMatrix
  return (FALLBACK_LABELS as Record<string, string>)[role] ?? role.replace(/_/g, ' ')
}

export function roleDescription(role: string, matrix?: AccessMatrix | null): string | null {
  return matrix?.roles.find((r) => r.id === role)?.description ?? null
}

/** Roles sorted into the backend's order; unknown ids go last, alphabetically. */
export function sortRoles<T extends string>(roles: readonly T[]): T[] {
  const rank = (r: string) => {
    const i = (ROLE_ORDER as readonly string[]).indexOf(r)
    return i === -1 ? ROLE_ORDER.length : i
  }
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** "Admin, Accounts" — a person's roles as one line. */
export function rolesLine(roles: readonly string[], matrix?: AccessMatrix | null): string {
  return sortRoles(roles).map((r) => roleLabel(r, matrix)).join(', ')
}

/**
 * Clerk `public_metadata` carries a copy of the roles (`roles`, or the older single `role`)
 * so the shell can say who is signed in before GET /employees/me answers. A first-paint
 * hint only — never used to show or hide anything.
 */
export function rolesHintFromMetadata(metadata: Record<string, unknown> | null | undefined): Role[] {
  const many = metadata?.roles
  if (Array.isArray(many)) return many.filter((r): r is Role => typeof r === 'string')
  const one = metadata?.role
  return typeof one === 'string' ? [one as Role] : []
}

/** Roles the matrix says hold `permission` — e.g. who can be picked to handle a service request. */
export function rolesHolding(matrix: AccessMatrix | null | undefined, permission: string): Role[] {
  return (matrix?.roles ?? []).filter((r) => r.permissions.includes(permission)).map((r) => r.id)
}

/**
 * A role change or invitation that grants or removes one of these waits for a second
 * approver (access_control.md §5, switches `role.admin` / `role.accounts`, on by default).
 * The contract does not expose the switches, so the screen says "may need" and the 202
 * answer is the authority.
 */
export const SECOND_APPROVAL_ROLES: readonly Role[] = ['admin', 'accounts']

export function needsSecondApproval(before: readonly string[], after: readonly string[]): boolean {
  return SECOND_APPROVAL_ROLES.some((r) => before.includes(r) !== after.includes(r))
}
