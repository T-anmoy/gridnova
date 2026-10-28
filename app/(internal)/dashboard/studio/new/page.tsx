'use client'

import { Suspense } from 'react'
import { PageSkeleton, RequirePermission } from '@/components/dashboard/RequirePermission'
import NewProposal from '@/components/dashboard/studio/NewProposal'

export default function NewStudioProposalPage() {
  // useSearchParams (?template=) needs a Suspense boundary.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission rule="studio.edit" what="Creating Studio proposals">
        <NewProposal />
      </RequirePermission>
    </Suspense>
  )
}
