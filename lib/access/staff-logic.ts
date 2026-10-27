import type { Employee, Role } from '@/lib/dashboard/types'
import type { AccessMatrix, AccessRole, StaffInvitation } from './types'
import { rolesHolding, roleLabel, sortRoles } from './roles'

// Pure rules for the Employees screens (access_control.md §1, §3, §4). The server
// re-checks every one of them; these keep the screen from offering what it would refuse.

/** The roles this person may give, with the matrix's label and description, in display order. */
export function assignableRoles(matrix: AccessMatrix | undefined, canAssign: readonly Role[]): AccessRole[] {
  if (!matrix) return []
  const byId = new Map(matrix.roles.map((r) => [r.id, r]))
  return sortRoles(canAssign.filter((r) => byId.has(r))).map((r) => byId.get(r)!)
}

/**
 * Ticks or unticks a role. At most one of the exclusive roles (Sales, Engineer, Operations)
 * per person: ticking one unticks the others.
 */
export function toggleRole(selected: readonly Role[], role: Role, exclusive: readonly Role[]): Role[] {
  if (selected.includes(role)) return selected.filter((r) => r !== role)
  const kept = exclusive.includes(role) ? selected.filter((r) => !exclusive.includes(r)) : [...selected]
  return sortRoles([...kept, role])
}

/** Why this set of roles can't be saved, or null. */
export function rolesProblem(selected: readonly Role[], exclusive: readonly Role[]): string | null {
  if (selected.length === 0) return 'Pick at least one role.'
  if (selected.filter((r) => exclusive.includes(r)).length > 1) {
    return `A person can hold only one of ${exclusive.map((r) => roleLabel(r)).join(', ')}.`
  }
  return null
}

export function employeeRoles(e: Pick<Employee, 'role' | 'roles'>): Role[] {
  return sortRoles(e.roles?.length ? e.roles : [e.role])
}

/** §4 scope rule: you may act on someone only when every role they hold is one you may assign. */
export function withinScope(roles: readonly Role[], canAssign: readonly Role[]): boolean {
  return roles.every((r) => canAssign.includes(r))
}

export function sameRoles(a: readonly Role[], b: readonly Role[]): boolean {
  return a.length === b.length && a.every((r) => b.includes(r))
}

/** Active staff who can take a leaver's leads (a role holding `leads.be_assigned`), never the leaver. */
export function leadTakers(staff: Employee[] | undefined, matrix: AccessMatrix | undefined, leavingId: string): Employee[] {
  const takerRoles = rolesHolding(matrix, 'leads.be_assigned')
  return (staff ?? []).filter((e) => e.is_active && e.id !== leavingId && employeeRoles(e).some((r) => takerRoles.includes(r)))
}

/** Invitations still waiting to be used (a pending one past its date reads as `expired`). */
export function openInvitations(items: StaffInvitation[] | undefined): StaffInvitation[] {
  return (items ?? []).filter((i) => i.status === 'pending' || i.status === 'expired')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function inviteProblems(v: { name: string; email: string; roles: Role[] }, exclusive: readonly Role[]): Partial<Record<'name' | 'email' | 'roles', string>> {
  const out: Partial<Record<'name' | 'email' | 'roles', string>> = {}
  if (v.name.trim().length < 2) out.name = 'Enter the person’s full name.'
  if (!EMAIL.test(v.email.trim())) out.email = 'Enter a valid email address.'
  const r = rolesProblem(v.roles, exclusive)
  if (r) out.roles = r
  return out
}
