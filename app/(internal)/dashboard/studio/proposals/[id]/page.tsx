'use client'

import { Suspense } from 'react'
import { PageSkeleton, RequirePermission } from '@/components/dashboard/RequirePermission'
import StudioProposalPage from '@/components/dashboard/studio/StudioProposalPage'

export default function StudioProposalRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission rule="studio.view" what="The Proposal Studio">
        <StudioProposalPage mode="auto" />
      </RequirePermission>
    </Suspense>
  )
}
