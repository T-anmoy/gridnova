'use client'

import { useState } from 'react'
import { Clock, Loader2, Phone, ServerCrash, ShieldAlert, ShieldCheck, ShieldOff, ShieldQuestion, WifiOff } from 'lucide-react'
import { useVerifyAssociate } from '@/lib/associate/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { useIsOnline } from '@/components/OfflineBanner'
import { HELPLINE_DISPLAY, HELPLINE_TEL } from '@/lib/contact'
import type { Messages } from '@/lib/i18n/types'

type Copy = Messages['associates']['verify']
type Failure = 'notFound' | 'offline' | 'rateLimited' | 'server'

// Opened from an ID card's QR code, usually on a customer's phone at the door: a
// lost signal or a busy server must never read as "this person is not ours".
function failureOf(error: unknown, online: boolean): Failure {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'notFound'
    if (error.status === 429) return 'rateLimited'
    if (error.status === 0) return online ? 'server' : 'offline'
    if (error.status >= 500) return 'server'
    // Any other refusal (a malformed ID → 422) means there is no such Associate.
    return 'notFound'
  }
  return online ? 'server' : 'offline'
}

const callButton =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#e4e8ee] bg-white px-5 font-utility text-sm font-semibold text-[#0e2a63]'

function CallLink({ copy }: { copy: Copy }) {
  return (
    <a href={HELPLINE_TEL} className={callButton} data-testid="verify-call">
      <Phone className="h-4 w-4" aria-hidden="true" /> {copy.call} · {HELPLINE_DISPLAY}
    </a>
  )
}

export default function VerifyAssociateCard({ associateId, copy }: { associateId: string; copy: Copy }) {
  const { data, isLoading, isFetching, error, refetch } = useVerifyAssociate(associateId)
  const online = useIsOnline()
  // The photo is a short-lived signed link: a page left open past it shows the plain badge instead of a broken image.
  const [photoFailed, setPhotoFailed] = useState(false)

  const failure = error && !isLoading ? failureOf(error, online) : null
  const failureText: Record<Failure, { title: string; body: string; Icon: React.ElementType }> = {
    notFound: { title: copy.notFoundTitle, body: copy.notFoundBody, Icon: ShieldQuestion },
    offline: { title: copy.offlineTitle, body: copy.offlineBody, Icon: WifiOff },
    rateLimited: { title: copy.rateLimitedTitle, body: copy.rateLimitedBody, Icon: Clock },
    server: { title: copy.serverTitle, body: copy.serverBody, Icon: ServerCrash },
  }

  return (
    <div className="max-w-md mx-auto rounded-2xl border border-[#e4e8ee] bg-white p-6 sm:p-8 text-center" data-testid="verify-card">
      <span className="ref-tag text-[#2f5daa]">{copy.eyebrow}</span>
      <h1 className="mt-3 font-display text-2xl font-semibold text-[#0e2a63]">{copy.title}</h1>
      <p className="mt-2 font-utility text-xs text-[#111827]/65 [overflow-wrap:anywhere]">{copy.idLabel}: {associateId}</p>

      {isLoading && (
        <div role="status" className="mt-8 flex items-center justify-center gap-2 text-[#111827]/65">
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {copy.loading}
        </div>
      )}

      {failure && (
        <div className="mt-8" role="alert" data-testid={`verify-${failure}`}>
          {(() => {
            const { title, body, Icon } = failureText[failure]
            return (
              <>
                <Icon className="h-12 w-12 mx-auto text-[#111827]/65" aria-hidden="true" />
                <p className="mt-4 font-display text-lg font-semibold text-[#0e2a63]">{title}</p>
                <p className="mt-2 text-sm text-[#111827]/70 leading-relaxed">{body}</p>
                {failure === 'notFound' && <p className="mt-3 text-sm font-semibold text-[#7a2e0e] leading-relaxed">{copy.notFoundAdvice}</p>}
              </>
            )
          })()}
          <div className="mt-6 flex flex-col gap-3">
            {failure !== 'notFound' && (
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-5 font-utility text-sm font-semibold text-white disabled:opacity-60"
              >
                {isFetching && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {copy.retry}
              </button>
            )}
            <CallLink copy={copy} />
          </div>
        </div>
      )}

      {data && (
        <div className="mt-8" data-testid={`verify-${data.status}`}>
          {data.photo_url && !photoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photo_url}
              alt={data.name}
              onError={() => setPhotoFailed(true)}
              className="h-24 w-24 rounded-full object-cover mx-auto border-4 border-[#f7f9fc]"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-[#f7f9fc] mx-auto flex items-center justify-center">
              {data.status === 'active' ? (
                <ShieldCheck className="h-10 w-10 text-green-600" aria-hidden="true" />
              ) : (
                <ShieldOff className="h-10 w-10 text-[#111827]/65" aria-hidden="true" />
              )}
            </div>
          )}
          <p className="mt-4 font-display text-xl font-semibold text-[#0e2a63] [overflow-wrap:anywhere]">{data.name}</p>
          <p className="mt-1 font-utility text-sm text-[#111827]/65">
            {data.type === 'preferred_associate' ? copy.typePreferred : copy.typeAssociate}
            {data.level && ` · ${levelLabel(data.level, copy)}`}
          </p>
          <span
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-utility text-xs font-semibold ${
              data.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {data.status === 'active' ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
            {data.status === 'active' ? copy.statusActive : copy.statusInactive}
          </span>
          {data.status !== 'active' && <p className="mt-4 text-sm font-semibold text-red-800 leading-relaxed">{copy.inactiveBody}</p>}
          <p className="mt-5 text-xs text-[#111827]/65 leading-relaxed">{copy.paymentNote}</p>
          <p className="mt-2 text-[11px] text-[#111827]/65">{copy.statusNote}</p>
          {data.status !== 'active' && (
            <div className="mt-5">
              <CallLink copy={copy} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function levelLabel(level: string, copy: Copy): string {
  if (level === 'state_head') return copy.levelStateHead
  if (level === 'district_head') return copy.levelDistrictHead
  return copy.levelBlock
}
