'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NoAccess from '@/components/dashboard/NoAccess'
import { ArchiveImport } from '@/components/dashboard/archive/ArchiveImport'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/lib/access/use-permissions'

/** archive.manage only — the import and void routes refuse everyone else. */
export default function ArchiveImportPage() {
  const { can, isLoaded } = usePermissions()
  if (!isLoaded) return <Skeleton className="h-8 w-48" />
  if (!can('archive.manage')) return <NoAccess what="Archive import" />
  return (
    <div className="space-y-4">
      <Link href="/dashboard/archive" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#0e2a63]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Project archive
      </Link>
      <ArchiveImport />
    </div>
  )
}
