'use client'

import { useParams } from 'next/navigation'
import NoAccess from '@/components/dashboard/NoAccess'
import ServiceRequestDetail from '@/components/dashboard/handover/ServiceRequestDetail'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'

const READ_ROLES = ['admin', 'management', 'engineer', 'operations', 'sales']

export default function ServiceRequestPage() {
  const { id } = useParams<{ id: string }>()
  const { role, isLoaded } = useStaffRole()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-8 w-48" /></div>
  if (!role || !READ_ROLES.includes(role)) return <NoAccess what="Service requests" />
  return (
    <div className="p-6 md:p-8">
      <ServiceRequestDetail requestId={Number(id)} />
    </div>
  )
}
