'use client'

import { RequirePermission } from '@/components/dashboard/RequirePermission'
import Import from '@/components/dashboard/studio/Import'

export default function StudioImportPage() {
  return (
    <RequirePermission rule="studio.edit" what="Importing Studio proposals">
      <Import />
    </RequirePermission>
  )
}
