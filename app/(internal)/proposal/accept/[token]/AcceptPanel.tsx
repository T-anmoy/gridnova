'use client'

import { useRef, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { API_BASE_URL } from '@/lib/config'
import {
  acceptApiPath,
  normalizeAcceptResponse,
  screenForAcceptError,
  validateAcceptResponse,
  type AcceptScreen,
  type AcceptView,
} from '@/lib/proposal-accept'
import { formatCurrency, formatDate } from '@/lib/dashboard/utils'
import { AcceptedBody, Card, MessageScreen, PdfLink, Shell, isMessageScreen } from './AcceptShell'

// The proposal summary is fetched and rendered on the server (page.tsx); this
// client component owns only the Accept action and what follows it.
export function AcceptPanel({ token, view }: { token: string; view: AcceptView }) {
  const [screen, setScreen] = useState<AcceptScreen>('ready')
  const [current, setCurrent] = useState<AcceptView>(view)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  // A ref, not state: two taps in the same frame both see `false` in state.
  const inFlight = useRef(false)

  async function handleAccept() {
    if (inFlight.current) return
    inFlight.current = true
    setAccepting(true)
    setAcceptError(null)
    try {
      const res = await fetch(`${API_BASE_URL}${acceptApiPath(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body: unknown = await res.json().catch(() => null)
      if (res.ok) {
        const v = normalizeAcceptResponse(validateAcceptResponse(body))
        setCurrent((prev) => ({ ...prev, ...v, acceptedAt: v.acceptedAt ?? new Date().toISOString() }))
        setScreen('accepted')
        return
      }
      const mapped = screenForAcceptError(res.status, body)
      if (mapped !== 'error' && mapped !== 'ready') {
        setScreen(mapped)
        return
      }
      // Recoverable — keep the summary visible and let them retry.
      setAcceptError('We couldn’t record your acceptance just now. Please try again in a moment.')
    } catch {
      setAcceptError('We couldn’t reach our server. Please check your connection and try again.')
    } finally {
      inFlight.current = false
      setAccepting(false)
    }
  }

  if (isMessageScreen(screen)) return <MessageScreen screen={screen} />
  if (screen === 'accepted') {
    return (
      <Shell>
        <AcceptedBody view={current} token={token} />
      </Shell>
    )
  }

  return (
    <Shell>
      <Card>
        <p className="font-utility text-[11px] tracking-[0.18em] text-[#2f5daa] uppercase">Your Solar Proposal</p>
        <h1 className="mt-2 font-display text-2xl md:text-3xl font-semibold text-[#091c3c] leading-tight">
          {current.customerName ? `Proposal for ${current.customerName}` : 'Review & accept your proposal'}
        </h1>
        {current.company && <p className="mt-1 font-utility text-sm text-[#111827]/55">{current.company}</p>}

        {current.scope && (
          <div className="mt-6">
            <p className="font-utility text-xs font-semibold uppercase tracking-wider text-[#111827]/50">Scope</p>
            <p className="mt-2 font-utility text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">{current.scope}</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-4">
            <p className="font-utility text-xs text-[#111827]/50 uppercase tracking-wider">Total price</p>
            <p className="mt-1 font-display text-xl font-bold text-[#091c3c]">{formatCurrency(current.totalValue)}</p>
          </div>
          <div className="rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-4">
            <p className="font-utility text-xs text-[#111827]/50 uppercase tracking-wider">Valid until</p>
            <p className="mt-1 font-display text-xl font-bold text-[#091c3c]">
              {current.validUntil ? formatDate(current.validUntil) : '—'}
            </p>
          </div>
        </div>

        <div aria-live="polite">
          {acceptError && (
            <p role="alert" className="mt-5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 font-utility text-sm text-amber-800">
              {acceptError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={accepting}
          aria-busy={accepting}
          className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#f7a800] text-[#091c3c] font-utility font-semibold text-sm px-6 py-3.5 min-h-11 hover:bg-[#ffb92e] active:scale-[0.99] transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#091c3c]"
        >
          {accepting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Recording your acceptance…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Accept Proposal
            </>
          )}
        </button>
        <p className="mt-3 font-utility text-xs text-[#111827]/40 text-center">
          By accepting, you confirm you’d like to proceed with this proposal.
        </p>
        {current.pdfAvailable && <PdfLink token={token} />}
      </Card>
    </Shell>
  )
}
