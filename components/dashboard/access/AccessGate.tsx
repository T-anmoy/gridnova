'use client'

import { signInBlockOf } from '@/lib/access/errors'
import { usePermissions } from '@/lib/access/use-permissions'
import { SignInBlocked } from './SignInBlocked'

/**
 * Wraps the dashboard shell. When GET /employees/me refuses the signed-in person —
 * not invited, invitation expired, address in use, deactivated, or the identity check
 * down — the whole dashboard is replaced by a plain explanation (FE-17 §7).
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { error } = usePermissions()
  const block = signInBlockOf(error)
  if (block) return <SignInBlocked kind={block} />
  return <>{children}</>
}
