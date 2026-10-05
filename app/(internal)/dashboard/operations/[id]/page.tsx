'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import ExecutionDetailPanel from '@/components/dashboard/ExecutionDetailPanel'
import type { Role } from '@/lib/dashboard/types'

export default function OperationsProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined
  return (
    <div className="space-y-4 p-6 md:p-8">
      <Link href="/dashboard/operations" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0e2a63]">
        <ArrowLeft className="h-4 w-4" /> Operations
      </Link>
      <ExecutionDetailPanel onboardingId={Number(id)} role={role} />
    </div>
  )
}
