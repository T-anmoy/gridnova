'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NoAccess from '@/components/dashboard/NoAccess'
import { ArchiveImport } from '@/components/dashboard/archive/ArchiveImport'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'

/** Admin only — the import and void routes refuse every other role. */
export default function ArchiveImportPage() {
  const { role, isLoaded } = useStaffRole()
  if (!isLoaded) return <Skeleton className="h-8 w-48" />
  if (role !== 'admin') return <NoAccess what="Archive import" />
  return (
    <div className="space-y-4">
      <Link href="/dashboard/archive" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#0e2a63]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Project archive
      </Link>
      <ArchiveImport />
    </div>
  )
}
