'use client'

import { Suspense } from 'react'
import { PageSkeleton, RequirePermission } from '@/components/dashboard/RequirePermission'
import ProposalsList from '@/components/dashboard/studio/ProposalsList'

export default function StudioProposalsPage() {
  // Filters live in the URL (useSearchParams needs a Suspense boundary).
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission rule="studio.view" what="The Proposal Studio">
        <ProposalsList />
      </RequirePermission>
    </Suspense>
  )
}
