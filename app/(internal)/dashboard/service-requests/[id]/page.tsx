'use client'

import { useParams } from 'next/navigation'
import NoAccess from '@/components/dashboard/NoAccess'
import ServiceRequestDetail from '@/components/dashboard/handover/ServiceRequestDetail'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/lib/access/use-permissions'

export default function ServiceRequestPage() {
  const { id } = useParams<{ id: string }>()
  const { can, isLoaded } = usePermissions()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-8 w-48" /></div>
  if (!can('execution.view')) return <NoAccess what="Service requests" />
  return (
    <div className="p-6 md:p-8">
      <ServiceRequestDetail requestId={Number(id)} />
    </div>
  )
}
