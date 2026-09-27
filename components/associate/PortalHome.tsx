'use client'

import { Loader2 } from 'lucide-react'
import { useAssociateMe } from '@/lib/associate/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { fmt, type Messages } from '@/lib/i18n/types'

type HomeCopy = Messages['associates']['portal']['associate']['home']

export default function PortalHome({ copy }: { copy: HomeCopy }) {
  const { data: me, isLoading, error, refetch } = useAssociateMe()

  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#111827]/30" />
      </div>
    )
  }

  const statusNote =
    me.status === 'active' ? copy.statusActive : me.status === 'suspended' ? copy.statusSuspended : copy.statusDeactivated

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{fmt(copy.title, { name: me.full_name })}</h1>
      <p className="mt-1 font-utility text-sm text-[#111827]/50">
        {fmt(copy.subtitle, { associateId: me.associate_id, level: me.level ? me.level.replace(/_/g, ' ') : '' })}
      </p>
      <p className={`mt-3 font-utility text-sm ${me.status === 'active' ? 'text-green-700' : 'text-amber-700'}`}>{statusNote}</p>

      <div className="mt-8 rounded-2xl border border-dashed border-[#e4e8ee] bg-white p-8 text-center">
        <p className="font-display text-lg font-semibold text-[#0e2a63]">{copy.emptyTitle}</p>
        <p className="mt-2 text-sm text-[#111827]/55 leading-relaxed max-w-md mx-auto">{copy.emptyBody}</p>
      </div>
    </div>
  )
}
