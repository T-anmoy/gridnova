import * as clerk from '@clerk/nextjs'
import { satisfies, type PermissionRule } from '@/lib/access/permissions'
import { rolesHintFromMetadata, sortRoles } from '@/lib/access/roles'
import type { Permissions } from '@/lib/access/use-permissions'
import type { Role } from '@/lib/dashboard/types'
import { ACCESS_MATRIX } from '../fixtures/access-matrix'

/** The permission union the BE-17 matrix gives these roles (what GET /employees/me returns). */
export function permissionsFor(roles: readonly string[]): string[] {
  const out = new Set<string>()
  for (const r of roles) for (const p of ACCESS_MATRIX.roles.find((x) => x.id === r)?.permissions ?? []) out.add(p)
  return [...out]
}

/** A GET /employees/me body for these roles — for tests that mock the API itself. */
export function employeeMeFor(roles: Role[], extra: Partial<Record<string, unknown>> = {}) {
  const sorted = sortRoles(roles)
  const assign = new Set<Role>()
  for (const r of sorted) for (const a of ACCESS_MATRIX.roles.find((x) => x.id === r)?.can_assign_roles ?? []) assign.add(a)
  return {
    id: 'user_test',
    role: sorted[0],
    roles: sorted,
    permissions: permissionsFor(sorted),
    two_factor_ok: true,
    requires_two_factor: sorted.some((r) => ACCESS_MATRIX.roles.find((x) => x.id === r)?.requires_two_factor),
    can_assign_roles: [...assign],
    regions: [],
    is_active: true,
    google_calendar_connected: false,
    ...extra,
  }
}

/** Builds the usePermissions() value for a set of roles (unknown/absent roles → nothing allowed). */
export function permissionsValue(roles: Role[], opts: { isLoaded?: boolean; employeeId?: string; twoFactorOk?: boolean } = {}): Permissions {
  const granted = new Set(permissionsFor(roles))
  const me = employeeMeFor(roles)
  const isLoaded = opts.isLoaded ?? true
  return {
    isLoaded,
    roles: sortRoles(roles),
    primaryRole: sortRoles(roles)[0],
    employeeId: opts.employeeId,
    can: (rule: PermissionRule) => isLoaded && roles.length > 0 && satisfies(granted, rule),
    twoFactorOk: opts.twoFactorOk ?? true,
    requiresTwoFactor: me.requires_two_factor,
    canAssignRoles: me.can_assign_roles,
    error: null,
  }
}

let override: Role[] | null = null

/**
 * Signs the test in with these roles (whatever Clerk is mocked to say) and returns `node`,
 * so a component that reads usePermissions() can be rendered inline:
 * `render(asRoles(['engineer'], <SurveyPanel onboardingId={12} />))`. Cleared after each test.
 */
export function asRoles<T>(roles: (Role | string | undefined)[], node: T): T {
  override = roles.filter((r): r is Role => typeof r === 'string')
  return node
}

export function clearRoleOverride() {
  override = null
}

/**
 * The global test double for usePermissions (vitest.setup.ts): the roles come from whatever
 * the test mocked Clerk's useUser() to return; with no Clerk mock, nobody is signed in.
 */
export function permissionsForRolesHook(): Permissions {
  let user: { id?: string; publicMetadata?: Record<string, unknown> } | null | undefined
  let isLoaded = true
  try {
    const value = (clerk.useUser as unknown as () => { user?: typeof user; isLoaded?: boolean })()
    user = value?.user
    if (value && value.isLoaded === false) isLoaded = false
  } catch {
    user = null
  }
  const roles = override ?? rolesHintFromMetadata(user?.publicMetadata)
  return permissionsValue(roles, { isLoaded: override ? true : isLoaded, employeeId: user?.id })
}

/** `can()` for a person holding these roles (the BE-17 matrix). */
export const canFor = (...roles: Role[]) => permissionsValue(roles).can
