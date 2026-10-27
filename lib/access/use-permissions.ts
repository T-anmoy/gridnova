'use client'

import { useCallback, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import type { Role } from '@/lib/dashboard/types'
import { useEmployeeMe } from './api'
import { satisfies, type PermissionRule } from './permissions'
import { rolesHintFromMetadata, sortRoles } from './roles'

export interface Permissions {
  /** True once GET /employees/me has answered (successfully or not). */
  isLoaded: boolean
  /** The roles held — from the server once loaded; before that Clerk's copy, for display only. */
  roles: Role[]
  /** The primary role, for display and role-specific wording only. */
  primaryRole: Role | undefined
  employeeId: string | undefined
  /** `can()` answers false until the server has answered: nothing shows on a guess. */
  can: (rule: PermissionRule) => boolean
  twoFactorOk: boolean
  requiresTwoFactor: boolean
  canAssignRoles: Role[]
  /** The GET /employees/me error (not_invited, deactivated, …), if any. */
  error: unknown
}

const EMPTY: ReadonlySet<string> = new Set()

/**
 * The one permissions source in the browser (FE-17). Every menu item, button and page
 * guard asks `can(permission)`; the server stays the authority and refuses anything the
 * screen got wrong.
 */
export function usePermissions(): Permissions {
  const { user } = useUser()
  const me = useEmployeeMe()
  const data = me.data
  const granted = useMemo(() => (data ? new Set(data.permissions ?? []) : EMPTY), [data])
  const can = useCallback((rule: PermissionRule) => !!data && satisfies(granted, rule), [data, granted])
  const hint = rolesHintFromMetadata(user?.publicMetadata as Record<string, unknown> | undefined)
  const roles = sortRoles(data ? (data.roles?.length ? data.roles : [data.role]) : hint)
  return {
    isLoaded: !me.isPending,
    roles,
    primaryRole: data?.role ?? roles[0],
    employeeId: data?.id,
    can,
    twoFactorOk: data?.two_factor_ok ?? true,
    requiresTwoFactor: data?.requires_two_factor ?? false,
    canAssignRoles: data?.can_assign_roles ?? [],
    error: me.error,
  }
}
