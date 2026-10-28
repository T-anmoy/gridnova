'use client'

import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { CustomerDetail } from '@/components/dashboard/studio/Customers'

export default function StudioCustomerPage() {
  return (
    <RequirePermission rule="studio.view" what="The Proposal Studio">
      <CustomerDetail />
    </RequirePermission>
  )
}
