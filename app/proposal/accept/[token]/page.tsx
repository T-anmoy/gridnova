'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, Clock, FileX2, Loader2, ShieldCheck } from 'lucide-react'
import headerLogo from '@/public/brand/header-logo.png'
import { formatCurrency, formatDate } from '@/lib/dashboard/utils'
import {
  normalizeAcceptResponse,
  isAccepted,
  screenForHttpStatus,
  type AcceptView,
  type AcceptScreen,
} from '@/lib/proposal-accept'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100svh] bg-[#f4f6fa] flex flex-col">
      {/* Brand band */}
      <div className="bg-[#091c3c]">
        <div className="mx-auto max-w-[680px] px-6 py-5 flex items-center">
          <span className="inline-flex bg-white/95 rounded-xl px-3 py-1.5 shadow-sm">
            <Image src={headerLogo} alt="Grid Nova Energy" width={115} height={30} className="h-7 w-auto" priority />
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 py-12 md:py-16">
        <div className="w-full max-w-[560px]">{children}</div>
      </div>

      <footer className="mx-auto max-w-[680px] w-full px-6 pb-8 text-center">
        <p className="font-utility text-xs text-[#111827]/40">
          © {new Date().getFullYear()} Grid Nova Energy · Kolkata, West Bengal
        </p>
      </footer>
    </main>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e4e8ee] bg-white p-7 md:p-9 shadow-[0_20px_60px_-24px_rgba(9,28,60,0.25)]">
      {children}
    </div>
  )
}

export default function ProposalAcceptPage() {
  const { token } = useParams<{ token: string }>()

  const [screen, setScreen] = useState<AcceptScreen>('loading')
  const [view, setView] = useState<AcceptView | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Note: no synchronous setState here — initial state is already 'loading',
    // and the "Try again" handler resets to 'loading' before re-invoking.
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/proposals/accept/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        setScreen(screenForHttpStatus(res.status))
        return
      }
      const data = await res.json().catch(() => null)
      const v = normalizeAcceptResponse(data)
      setView(v)
      setScreen(isAccepted(v) ? 'accepted' : 'ready')
    } catch {
      setScreen('error')
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    // Defer the fetch out of the synchronous effect body so its state updates
    // never run synchronously during the effect.
    const id = setTimeout(() => void load(), 0)
    return () => clearTimeout(id)
  }, [token, load])

  async function handleAccept() {
    setAccepting(true)
    setAcceptError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/proposals/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        const v = normalizeAcceptResponse(data)
        setView((prev) => ({ ...(prev ?? v), ...v, acceptedAt: v.acceptedAt ?? new Date().toISOString() }))
        setScreen('accepted')
        return
      }
      const mapped = screenForHttpStatus(res.status)
      if (mapped === 'accepted' || mapped === 'notfound' || mapped === 'expired') {
        setScreen(mapped)
        return
      }
      // Recoverable — keep the summary visible and let them retry.
      setAcceptError('We couldn’t record your acceptance just now. Please try again in a moment.')
    } catch {
      setAcceptError('We couldn’t reach our server. Please check your connection and try again.')
    } finally {
      setAccepting(false)
    }
  }

  // ── Screens ────────────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <Shell>
        <Card>
          <div className="flex items-center gap-3 text-[#111827]/50">
            <Loader2 className="h-5 w-5 animate-spin text-[#f7a800]" />
            <span className="font-utility text-sm">Loading your proposal…</span>
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-4 w-2/3 rounded bg-[#eef1f6] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[#eef1f6] animate-pulse" />
            <div className="h-24 w-full rounded-xl bg-[#eef1f6] animate-pulse" />
          </div>
        </Card>
      </Shell>
    )
  }

  if (screen === 'notfound' || screen === 'error') {
    return (
      <Shell>
        <Card>
          <FileX2 className="h-10 w-10 text-[#111827]/25" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-[#091c3c]">
            {screen === 'notfound' ? 'Proposal not found' : 'Something went wrong'}
          </h1>
          <p className="mt-2 font-utility text-sm text-[#111827]/60 leading-relaxed">
            {screen === 'notfound'
              ? 'This proposal link is invalid or has already been used. If you believe this is a mistake, please contact our team.'
              : 'We had trouble loading this proposal. Please try again shortly.'}
          </p>
          {screen === 'error' && (
            <button
              onClick={() => { setScreen('loading'); void load() }}
              className="mt-6 inline-flex items-center rounded-full bg-[#091c3c] text-white font-utility text-sm font-semibold px-5 py-2.5 hover:bg-[#0e2a63] transition-colors"
            >
              Try again
            </button>
          )}
          <p className="mt-6 font-utility text-xs text-[#111827]/40">
            Questions? Email{' '}
            <a href="mailto:info@gridnova.in" className="text-[#0e2a63] font-medium hover:underline">
              info@gridnova.in
            </a>
          </p>
        </Card>
      </Shell>
    )
  }

  if (screen === 'expired') {
    return (
      <Shell>
        <Card>
          <Clock className="h-10 w-10 text-[#111827]/25" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-[#091c3c]">This proposal has expired</h1>
          <p className="mt-2 font-utility text-sm text-[#111827]/60 leading-relaxed">
            The validity window for this proposal has passed. Please reach out and we’ll be glad to prepare an updated quote.
          </p>
          <p className="mt-6 font-utility text-xs text-[#111827]/40">
            Email{' '}
            <a href="mailto:info@gridnova.in" className="text-[#0e2a63] font-medium hover:underline">
              info@gridnova.in
            </a>
          </p>
        </Card>
      </Shell>
    )
  }

  if (screen === 'accepted') {
    return (
      <Shell>
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <h1 className="font-display text-2xl font-semibold text-[#091c3c]">Proposal accepted</h1>
          </div>
          <p className="mt-3 font-utility text-sm text-[#111827]/65 leading-relaxed">
            Thank you{view?.customerName ? `, ${view.customerName}` : ''} — your acceptance has been recorded and our
            team has been notified. We’ll be in touch shortly with the next steps.
          </p>
          {view?.acceptedAt && (
            <p className="mt-4 font-utility text-xs text-[#111827]/45">
              Accepted on {formatDate(view.acceptedAt)}
            </p>
          )}
          {view?.totalValue != null && (
            <div className="mt-6 rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-4 flex items-center justify-between">
              <span className="font-utility text-sm text-[#111827]/60">Accepted value</span>
              <span className="font-display text-lg font-bold text-[#091c3c]">{formatCurrency(view.totalValue)}</span>
            </div>
          )}
          <p className="mt-6 font-utility text-xs text-[#111827]/40">
            Questions? Email{' '}
            <a href="mailto:info@gridnova.in" className="text-[#0e2a63] font-medium hover:underline">
              info@gridnova.in
            </a>
          </p>
        </Card>
      </Shell>
    )
  }

  // screen === 'ready'
  return (
    <Shell>
      <Card>
        <p className="font-utility text-[11px] tracking-[0.18em] text-[#2f5daa] uppercase">Your Solar Proposal</p>
        <h1 className="mt-2 font-display text-2xl md:text-3xl font-semibold text-[#091c3c] leading-tight">
          {view?.customerName ? `Proposal for ${view.customerName}` : 'Review & accept your proposal'}
        </h1>
        {view?.company && (
          <p className="mt-1 font-utility text-sm text-[#111827]/55">{view.company}</p>
        )}

        {view?.scope && (
          <div className="mt-6">
            <p className="font-utility text-xs font-semibold uppercase tracking-wider text-[#111827]/50">Scope</p>
            <p className="mt-2 font-utility text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">{view.scope}</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-4">
            <p className="font-utility text-xs text-[#111827]/50 uppercase tracking-wider">Total price</p>
            <p className="mt-1 font-display text-xl font-bold text-[#091c3c]">{formatCurrency(view?.totalValue)}</p>
          </div>
          <div className="rounded-xl bg-[#f7f9fc] border border-[#e4e8ee] p-4">
            <p className="font-utility text-xs text-[#111827]/50 uppercase tracking-wider">Valid until</p>
            <p className="mt-1 font-display text-xl font-bold text-[#091c3c]">
              {view?.validUntil ? formatDate(view.validUntil) : '—'}
            </p>
          </div>
        </div>

        {acceptError && (
          <p className="mt-5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 font-utility text-sm text-amber-800">
            {acceptError}
          </p>
        )}

        <button
          onClick={() => void handleAccept()}
          disabled={accepting}
          className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#f7a800] text-[#091c3c] font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#ffb92e] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {accepting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Recording your acceptance…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" /> Accept Proposal
            </>
          )}
        </button>
        <p className="mt-3 font-utility text-xs text-[#111827]/40 text-center">
          By accepting, you confirm you’d like to proceed with this proposal.
        </p>
      </Card>
    </Shell>
  )
}
