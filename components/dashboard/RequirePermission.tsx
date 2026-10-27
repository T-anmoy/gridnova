'use client'

import NoAccess from '@/components/dashboard/NoAccess'
import { Skeleton } from '@/components/ui/skeleton'
import type { PermissionRule } from '@/lib/access/permissions'
import { usePermissions } from '@/lib/access/use-permissions'

/**
 * Page guard: renders the page only when the server's permissions cover `rule`. While
 * GET /employees/me is loading it shows a skeleton (never the page on a guess); without
 * the permission it shows the calm no-access state — the page's own requests never run.
 */
export function RequirePermission({ rule, what, children }: { rule: PermissionRule; what: string; children: React.ReactNode }) {
  const { isLoaded, can } = usePermissions()
  if (!isLoaded) return <PageSkeleton />
  if (!can(rule)) return <NoAccess what={what} />
  return <>{children}</>
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" data-testid="permissions-loading" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
