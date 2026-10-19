'use client'

import { Sparkles } from 'lucide-react'
import NoAccess from '@/components/dashboard/NoAccess'
import { NovaChat } from '@/components/dashboard/nova/NovaChat'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { canUseNova } from '@/lib/nova/logic'

export default function NovaRecordsPage() {
  const { role, isLoaded } = useStaffRole()
  if (!isLoaded) return <div className="p-6 md:p-8"><Skeleton className="h-8 w-48" /></div>
  if (!canUseNova(role)) return <NoAccess what="Nova Records" />
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-[#091c3c] md:text-2xl">
          <Sparkles className="h-5 w-5 text-[#f7a800]" aria-hidden="true" />
          Nova Records
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Ask about any project, lead, payment, warranty or service request. Answers come only from records your role can see, and each one shows where it came from. Nova only reads — it never changes anything.
        </p>
      </div>
      <NovaChat variant="page" role={role} context={null} />
    </div>
  )
}
