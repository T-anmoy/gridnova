'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import OperationsProjectTabs from '@/components/dashboard/OperationsProjectTabs'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { SEES_EXECUTION } from '@/lib/dashboard/nav'

export default function OperationsProjectPage() {
  return (
    <RequirePermission rule={SEES_EXECUTION} what="The Operations workspace">
      <OperationsProjectPageContent />
    </RequirePermission>
  )
}

function OperationsProjectPageContent() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="space-y-4 p-6 md:p-8">
      <Link href="/dashboard/operations" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0e2a63]">
        <ArrowLeft className="h-4 w-4" /> Operations
      </Link>
      <OperationsProjectTabs onboardingId={Number(id)} />
    </div>
  )
}
