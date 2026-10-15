'use client'

import { Suspense } from 'react'
import ServiceRequestQueue from '@/components/dashboard/handover/ServiceRequestQueue'
import NoAccess from '@/components/dashboard/NoAccess'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'

const READ_ROLES = ['admin', 'management', 'engineer', 'operations', 'sales']

export default function ServiceRequestsPage() {
  const { role, isLoaded } = useStaffRole()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-8 w-48" /></div>
  // Accounts gets 403 from the backend, so it is not offered the page at all.
  if (!role || !READ_ROLES.includes(role)) return <NoAccess what="Service requests" />
  return (
    <div className="space-y-4 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[#091c3c]">Service requests</h1>
        {(role === 'management' || role === 'sales') && <p className="mt-1 text-sm text-gray-500">Read-only view.</p>}
      </div>
      <Suspense fallback={<Skeleton className="h-8 w-48" />}>
        <ServiceRequestQueue />
      </Suspense>
    </div>
  )
}
