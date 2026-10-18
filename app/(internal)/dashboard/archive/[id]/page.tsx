'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { ArchiveDossier } from '@/components/dashboard/archive/ArchiveDossier'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/dashboard/api-error'
import { useArchiveProject } from '@/lib/archive/api-client'

export default function ArchiveProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error, refetch } = useArchiveProject(Number(id))
  const notFound = error instanceof ApiError && error.status === 404
  return (
    <div className="space-y-4">
      <Link href="/dashboard/archive" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#0e2a63]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Project archive
      </Link>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : notFound ? (
        <div role="alert" data-testid="archive-not-found" className="rounded-xl border border-[#e4e8ee] bg-white px-4 py-10 text-center text-sm text-gray-700">
          This archived project doesn’t exist, or its import batch was voided.
        </div>
      ) : error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : data ? (
        <ArchiveDossier dossier={data} />
      ) : null}
    </div>
  )
}
