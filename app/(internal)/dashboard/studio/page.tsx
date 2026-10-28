'use client'

import { RequirePermission } from '@/components/dashboard/RequirePermission'
import StudioHome from '@/components/dashboard/studio/StudioHome'

export default function StudioHomePage() {
  return (
    <RequirePermission rule="studio.view" what="The Proposal Studio">
      <StudioHome />
    </RequirePermission>
  )
}
