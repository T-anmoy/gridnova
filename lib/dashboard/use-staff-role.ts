'use client'

import { useUser } from '@clerk/nextjs'
import type { Role } from '@/lib/dashboard/types'

/** The signed-in staff member's role, and whether Clerk has finished loading it. */
export function useStaffRole(): { role: Role | undefined; isLoaded: boolean } {
  const { user, isLoaded } = useUser()
  return { role: user?.publicMetadata?.role as Role | undefined, isLoaded }
}
