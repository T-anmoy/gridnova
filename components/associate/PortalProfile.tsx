'use client'

import { Loader2 } from 'lucide-react'
import { useAssociateMe } from '@/lib/associate/api-client'
import { PortalError } from '@/components/associate/PortalError'
import { useDates } from '@/lib/i18n/dates'
import type { Messages } from '@/lib/i18n/types'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-utility text-[11px] uppercase tracking-wide text-[#111827]/65">{label}</p>
      <p className="font-utility text-sm text-[#091c3c] mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

export default function PortalProfile({ copy }: { copy: Messages['associates']['portal']['associate']['profile'] }) {
  const { formatDate } = useDates()
  const { data: me, isLoading, error, refetch } = useAssociateMe()

  if (error) return <PortalError error={error} onRetry={() => void refetch()} />
  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#111827]/65" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <div className="mt-6 rounded-2xl border border-[#e4e8ee] bg-white p-6 grid grid-cols-2 gap-5">
        <Field label="Name" value={me.full_name} />
        <Field label="Email" value={me.email} />
        <Field label="Mobile" value={me.mobile} />
        <Field label={copy.status} value={me.status} />
        {me.capability && <Field label={copy.capability} value={me.capability} />}
        {me.level && <Field label={copy.level} value={me.level.replace(/_/g, ' ')} />}
        {me.territory && <Field label={copy.territory} value={me.territory} />}
        <Field label={copy.approvedOn} value={formatDate(me.approved_at)} />
      </div>
    </div>
  )
}
