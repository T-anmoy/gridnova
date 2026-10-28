'use client'

import { RequirePermission } from '@/components/dashboard/RequirePermission'
import Library from '@/components/dashboard/studio/Library'

export default function StudioLibraryPage() {
  return (
    <RequirePermission rule="studio.view" what="The Proposal Studio">
      <Library />
    </RequirePermission>
  )
}
