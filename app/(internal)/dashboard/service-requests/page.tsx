'use client'

import { Suspense } from 'react'
import ServiceRequestQueue from '@/components/dashboard/handover/ServiceRequestQueue'
import NoAccess from '@/components/dashboard/NoAccess'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/lib/access/use-permissions'

export default function ServiceRequestsPage() {
  const { can, isLoaded } = usePermissions()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-8 w-48" /></div>
  // Everyone who sees project execution reads them; Accounts gets 403 from the backend, so it is not offered the page at all.
  if (!can('execution.view')) return <NoAccess what="Service requests" />
  return (
    <div className="space-y-4 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[#091c3c]">Service requests</h1>
        {!can('service_requests.handle') && <p className="mt-1 text-sm text-gray-500">Read-only view.</p>}
      </div>
      <Suspense fallback={<Skeleton className="h-8 w-48" />}>
        <ServiceRequestQueue />
      </Suspense>
    </div>
  )
}
