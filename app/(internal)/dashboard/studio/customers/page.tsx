'use client'

import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { CustomersList } from '@/components/dashboard/studio/Customers'

export default function StudioCustomersPage() {
  return (
    <RequirePermission rule="studio.view" what="The Proposal Studio">
      <CustomersList />
    </RequirePermission>
  )
}
