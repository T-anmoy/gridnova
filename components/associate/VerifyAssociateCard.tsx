'use client'

import { Loader2, ShieldCheck, ShieldOff, ShieldQuestion } from 'lucide-react'
import { useVerifyAssociate } from '@/lib/associate/api-client'
import type { Messages } from '@/lib/i18n/types'

export default function VerifyAssociateCard({ associateId, copy }: { associateId: string; copy: Messages['associates']['verify'] }) {
  const { data, isLoading, error } = useVerifyAssociate(associateId)

  return (
    <div className="max-w-md mx-auto rounded-2xl border border-[#e4e8ee] bg-white p-8 text-center">
      <span className="ref-tag text-[#2f5daa]">{copy.eyebrow}</span>
      <h1 className="mt-3 font-display text-2xl font-semibold text-[#0e2a63]">{copy.title}</h1>
      <p className="mt-2 font-utility text-xs text-[#111827]/65">{copy.idLabel}: {associateId}</p>

      {isLoading && (
        <div className="mt-8 flex items-center justify-center gap-2 text-[#111827]/65">
          <Loader2 className="h-5 w-5 animate-spin" /> {copy.loading}
        </div>
      )}

      {error && !isLoading && (
        <div className="mt-8">
          <ShieldQuestion className="h-12 w-12 mx-auto text-[#111827]/65" />
          <p className="mt-4 font-display text-lg font-semibold text-[#0e2a63]">{copy.notFoundTitle}</p>
          <p className="mt-2 text-sm text-[#111827]/65 leading-relaxed">{copy.notFoundBody}</p>
        </div>
      )}

      {data && (
        <div className="mt-8">
          {data.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photo_url} alt={data.name} className="h-24 w-24 rounded-full object-cover mx-auto border-4 border-[#f7f9fc]" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-[#f7f9fc] mx-auto flex items-center justify-center">
              {data.status === 'active' ? (
                <ShieldCheck className="h-10 w-10 text-green-600" />
              ) : (
                <ShieldOff className="h-10 w-10 text-[#111827]/65" />
              )}
            </div>
          )}
          <p className="mt-4 font-display text-xl font-semibold text-[#0e2a63]">{data.name}</p>
          <p className="mt-1 font-utility text-sm text-[#111827]/65">
            {data.type === 'preferred_associate' ? copy.typePreferred : copy.typeAssociate}
            {data.level && ` · ${levelLabel(data.level, copy)}`}
          </p>
          <span
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-utility text-xs font-semibold ${
              data.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {data.status === 'active' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
            {data.status === 'active' ? copy.statusActive : copy.statusInactive}
          </span>
          <p className="mt-5 text-[11px] text-[#111827]/65">{copy.statusNote}</p>
        </div>
      )}
    </div>
  )
}

function levelLabel(level: string, copy: Messages['associates']['verify']): string {
  if (level === 'state_head') return copy.levelStateHead
  if (level === 'district_head') return copy.levelDistrictHead
  return copy.levelBlock
}
