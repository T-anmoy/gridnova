'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, XCircle } from 'lucide-react'
import { ApiError } from '@/lib/dashboard/api-error'
import { HELPLINE_DISPLAY, HELPLINE_TEL } from '@/lib/contact'
import type { Messages } from '@/lib/i18n/types'
import { fmt } from '@/lib/i18n/types'
import { formatInr } from '@/lib/money'
import { kwpText } from '@/lib/studio/logic'
import { fetchVerification } from '@/lib/studio/public-api'
import type { ProposalVerification, VerifyStatus } from '@/lib/studio/types'

// What the QR on a Studio proposal's last page opens (proposal_studio.md §11). Only a
// current, open proposal gets the green "genuine" result; a replaced or expired one is
// clearly not something to pay against.

type Copy = Messages['proposalVerify']
type Load = { kind: 'loading' } | { kind: 'notfound' } | { kind: 'error' } | { kind: 'ready'; data: ProposalVerification }

const LOOK: Record<VerifyStatus, { tone: string; ring: string; icon: React.ElementType; title: keyof Copy; body: keyof Copy }> = {
  valid: { tone: 'bg-green-50 text-green-800', ring: 'border-green-200', icon: ShieldCheck, title: 'statusValidTitle', body: 'statusValidBody' },
  superseded: { tone: 'bg-amber-50 text-amber-900', ring: 'border-amber-300', icon: ShieldAlert, title: 'statusSupersededTitle', body: 'statusSupersededBody' },
  expired: { tone: 'bg-amber-50 text-amber-900', ring: 'border-amber-300', icon: ShieldAlert, title: 'statusExpiredTitle', body: 'statusExpiredBody' },
  accepted: { tone: 'bg-blue-50 text-blue-900', ring: 'border-blue-200', icon: CheckCircle2, title: 'statusAcceptedTitle', body: 'statusAcceptedBody' },
  declined: { tone: 'bg-gray-100 text-gray-800', ring: 'border-gray-300', icon: XCircle, title: 'statusDeclinedTitle', body: 'statusDeclinedBody' },
}

const INTL_LOCALE: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN' }

export default function VerifyProposalCard({ code, copy, locale }: { code: string; copy: Copy; locale: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const run = useCallback(
    (signal?: AbortSignal) =>
      fetchVerification(code, signal).then(
        (data) => setLoad({ kind: 'ready', data }),
        (e) => {
          if (signal?.aborted) return
          setLoad(e instanceof ApiError && (e.status === 404 || e.status === 422) ? { kind: 'notfound' } : { kind: 'error' })
        },
      ),
    [code],
  )
  useEffect(() => {
    const ctrl = new AbortController()
    void run(ctrl.signal)
    return () => ctrl.abort()
  }, [run])

  const date = (d: string | null) =>
    d ? new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d.slice(0, 10)}T12:00:00+05:30`)) : '—'

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#e4e8ee] bg-white p-6 sm:p-8" data-testid="verify-proposal">
      <div className="text-center">
        <span className="ref-tag text-[#2f5daa]">{copy.eyebrow}</span>
        <h1 className="mt-3 font-display text-2xl font-semibold text-[#0e2a63]">{copy.title}</h1>
        <p className="mt-2 font-utility text-xs text-[#111827]/65">
          {copy.codeLabel}: <span className="font-mono">{code}</span>
        </p>
      </div>

      {load.kind === 'loading' && (
        <p className="mt-8 flex items-center justify-center gap-2 text-[#111827]/65" role="status">
          <Loader2 className="h-5 w-5 animate-spin" /> {copy.loading}
        </p>
      )}

      {load.kind === 'notfound' && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-center" data-testid="verify-status-unknown" role="alert">
          <ShieldQuestion className="mx-auto h-10 w-10 text-red-700" />
          <p className="mt-3 font-display text-lg font-semibold text-red-900">{copy.notFoundTitle}</p>
          <p className="mt-1 font-utility text-sm leading-relaxed text-red-900">{copy.notFoundBody}</p>
        </div>
      )}

      {load.kind === 'error' && (
        <div className="mt-8 text-center">
          <p className="font-utility text-sm text-[#111827]/75">{copy.errorBody}</p>
          <button type="button" onClick={() => { setLoad({ kind: 'loading' }); void run() }} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[#e4e8ee] px-5 font-utility text-sm font-semibold text-[#0e2a63]">
            {copy.retry}
          </button>
        </div>
      )}

      {load.kind === 'ready' && (() => {
        const d = load.data
        const look = LOOK[d.status] ?? LOOK.expired
        const Icon = look.icon
        return (
          <>
            <div className={`mt-6 rounded-xl border p-5 text-center ${look.tone} ${look.ring}`} data-testid={`verify-status-${d.status}`} role="status">
              <Icon className="mx-auto h-10 w-10" aria-hidden="true" />
              <p className="mt-3 font-display text-lg font-semibold">{copy[look.title]}</p>
              <p className="mt-1 font-utility text-sm leading-relaxed">{copy[look.body]}</p>
            </div>
            <dl className="mt-5 divide-y divide-[#eef1f5] font-utility text-sm">
              {[
                [copy.reference, d.reference ?? '—'],
                [copy.date, date(d.date)],
                [copy.project, `${d.title}${d.capacity_kwp && !d.title.includes('kWp') ? ` · ${kwpText(d.capacity_kwp)}` : ''}`],
                [copy.total, formatInr(d.total_incl_gst)],
                [copy.validUntil, date(d.valid_until)],
                [copy.customer, d.customer ?? '—'],
                [copy.issuer, d.issuer],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-[#111827]/65">{k}</dt>
                  <dd className="text-right font-medium text-[#0e2a63]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-center font-utility text-xs text-[#111827]/60">{copy.note}</p>
          </>
        )
      })()}

      <p className="mt-5 text-center font-utility text-sm">
        <a href={HELPLINE_TEL} className="inline-flex min-h-11 items-center text-[#0e2a63] underline-offset-2 hover:underline">
          {fmt(copy.contact, { phone: HELPLINE_DISPLAY })}
        </a>
      </p>
    </div>
  )
}
