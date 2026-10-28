'use client'

import { Suspense } from 'react'
import { PageSkeleton, RequirePermission } from '@/components/dashboard/RequirePermission'
import StudioProposalPage from '@/components/dashboard/studio/StudioProposalPage'

export default function StudioApprovalReviewRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission rule="studio.approve" what="Approving Studio proposals">
        <StudioProposalPage mode="review" />
      </RequirePermission>
    </Suspense>
  )
}
