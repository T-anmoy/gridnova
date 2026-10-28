'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Download, FileX2, Loader2, MapPin, Phone, RefreshCw, XCircle } from 'lucide-react'
import { ApiError } from '@/lib/dashboard/api-error'
import { HELPLINE_DISPLAY, HELPLINE_TEL } from '@/lib/contact'
import { formatInr } from '@/lib/money'
import { localBusinessSchema, patnaLocalBusinessSchema } from '@/lib/structured-data'
import { kwpText, validityText } from '@/lib/studio/logic'
import { acceptPublicProposal, declinePublicProposal, fetchPublicProposal, publicPdfUrl } from '@/lib/studio/public-api'
import type { PublicProposal, PublicState } from '@/lib/studio/types'
import { Card, Shell } from '../accept/[token]/AcceptShell'

// The customer's page for a Studio proposal (proposal_studio.md §11). Mobile first, English,
// no site navigation. Every amount is the API's; nothing is calculated here.

type Load = { kind: 'loading' } | { kind: 'notfound' } | { kind: 'error'; message: string } | { kind: 'ready'; view: PublicProposal }

const longDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const fmtDate = (d: string | null) => (d ? longDate.format(new Date(`${d.slice(0, 10)}T12:00:00+05:30`)) : '—')

const BUTTON = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-utility text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7a800] disabled:cursor-not-allowed disabled:opacity-60'
const FIELD = 'w-full min-h-12 rounded-xl border border-[#d5dbe4] bg-white px-3 py-2 text-base font-utility text-[#111827] outline-none focus-visible:border-[#2f5daa] focus-visible:ring-2 focus-visible:ring-[#f7a800]/60 aria-[invalid=true]:border-red-500'

export function OnlineProposal({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const fetchIt = useCallback(
    (signal?: AbortSignal) =>
      fetchPublicProposal(token, signal).then(
        (view) => setLoad({ kind: 'ready', view }),
        (e) => {
          if (signal?.aborted) return
          if (e instanceof ApiError && e.status === 404) setLoad({ kind: 'notfound' })
          else if (e instanceof ApiError && e.status === 429) setLoad({ kind: 'error', message: 'Too many requests from this connection. Please wait a minute and try again.' })
          else setLoad({ kind: 'error', message: 'We could not load the proposal. Please check your internet connection and try again.' })
        },
      ),
    [token],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    void fetchIt(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchIt])

  const setState = (state: PublicState, patch: Partial<PublicProposal> = {}) =>
    setLoad((l) => (l.kind === 'ready' ? { kind: 'ready', view: { ...l.view, ...patch, state } } : l))

  return (
    <Shell>
      {load.kind === 'loading' && (
        <Card>
          <p className="flex items-center justify-center gap-2 py-10 font-utility text-sm text-[#111827]/70" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Opening your proposal…
          </p>
        </Card>
      )}
      {load.kind === 'notfound' && (
        <Message icon={<FileX2 className="h-10 w-10 text-[#111827]/50" />} title="We could not find this proposal" body="The link may be incomplete. Please check it, or contact Grid Nova." testId="state-notfound" />
      )}
      {load.kind === 'error' && (
        <Message icon={<FileX2 className="h-10 w-10 text-[#111827]/50" />} title="Something went wrong" body={load.message} testId="state-error">
          <button type="button" onClick={() => { setLoad({ kind: 'loading' }); void fetchIt() }} className={`${BUTTON} mt-6 border border-[#e4e8ee] text-[#0e2a63] hover:bg-[#f7f9fc]`}>
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </Message>
      )}
      {load.kind === 'ready' && <Proposal token={token} view={load.view} onState={setState} />}
      <Contact />
    </Shell>
  )
}

function Message({ icon, title, body, children, testId }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode; testId: string }) {
  return (
    <Card>
      <div className="text-center" data-testid={testId}>
        <div className="flex justify-center">{icon}</div>
        <h1 className="mt-4 font-display text-xl font-semibold text-[#091c3c]">{title}</h1>
        <p className="mt-2 font-utility text-sm leading-relaxed text-[#111827]/75">{body}</p>
        {children}
      </div>
    </Card>
  )
}

function Line({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={`font-utility text-sm ${strong ? 'font-semibold text-[#091c3c]' : 'text-[#111827]/70'}`}>{label}</dt>
      <dd className={`text-right font-utility tabular-nums ${strong ? 'text-xl font-bold text-[#091c3c]' : 'text-sm text-[#111827]'}`}>{value}</dd>
    </div>
  )
}

function Proposal({ token, view, onState }: { token: string; view: PublicProposal; onState: (s: PublicState, patch?: Partial<PublicProposal>) => void }) {
  const pdf = publicPdfUrl(view, token)
  const subsidy = view.subsidy?.applies ? view.subsidy : null

  if (view.state === 'expired') {
    return (
      <Message icon={<Clock className="h-10 w-10 text-amber-600" />} title="This proposal has expired" body="This proposal has expired — please contact Grid Nova for an updated one." testId="state-expired" />
    )
  }
  if (view.state === 'superseded') {
    return (
      <Message icon={<RefreshCw className="h-10 w-10 text-[#2f5daa]" />} title="There is a newer version" body="A newer version of this proposal has been issued. Please use the latest link Grid Nova sent you, or contact us." testId="state-superseded" />
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <p className="font-utility text-xs uppercase tracking-[0.12em] text-[#2f5daa]">Solar proposal</p>
        <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-[#091c3c]">{view.title}</h1>
        <p className="mt-2 font-utility text-sm text-[#111827]/70">
          {view.reference} · {fmtDate(view.date)}
          {view.capacity_kwp ? ` · ${kwpText(view.capacity_kwp)}` : ''}
        </p>
        {view.customer_name && <p className="mt-1 font-utility text-sm text-[#111827]/70">For {view.customer_name}</p>}

        <dl className="mt-5 divide-y divide-[#eef1f5] border-y border-[#eef1f5]" data-testid="public-figures">
          {view.discount && (
            <>
              <Line label="Price before discount" value={formatInr(view.discount.price_before_discount)} />
              <Line label="Discount" value={`− ${formatInr(view.discount.amount)}`} />
            </>
          )}
          <Line label="Basic price" value={formatInr(view.basic)} />
          <Line label="GST" value={formatInr(view.gst)} />
          <Line label="Total, including GST" value={formatInr(view.total)} strong />
        </dl>
        {view.total_in_words && <p className="mt-2 font-utility text-xs italic text-[#111827]/65">{view.total_in_words}</p>}

        {subsidy && (
          <dl className="mt-4 rounded-xl bg-green-50 px-4" data-testid="public-subsidy">
            <Line label={subsidy.kind === 'housing_society' ? 'Government subsidy (CFA)' : 'PM Surya Ghar subsidy'} value={formatInr(subsidy.total)} />
            <Line label="Your cost after the subsidy" value={formatInr(subsidy.effective_cost)} strong />
          </dl>
        )}

        {view.payments.length > 0 && (
          <div className="mt-5">
            <h2 className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/55">When you pay</h2>
            <ol className="mt-1 divide-y divide-[#eef1f5]" data-testid="public-payments">
              {view.payments.map((p, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2 font-utility text-sm">
                  <span className="text-[#111827]/80">{p.percent}% — {p.label}</span>
                  <span className="tabular-nums">{formatInr(p.amount)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {view.state === 'open' && view.valid_until && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#f7f9fc] p-3 font-utility text-sm text-[#091c3c]" data-testid="public-validity">
            <Clock className="h-4 w-4 text-[#8a5a00]" aria-hidden="true" /> Valid until {fmtDate(view.valid_until)} — {validityText(view.valid_until)?.toLowerCase()}
          </p>
        )}

        <a href={pdf} className={`${BUTTON} mt-5 border border-[#e4e8ee] text-[#0e2a63] hover:bg-[#f7f9fc]`} data-testid="public-download">
          <Download className="h-4 w-4" /> Download the proposal (PDF)
        </a>
      </Card>

      {view.state === 'accepted' && (
        <Message icon={<CheckCircle2 className="h-10 w-10 text-green-600" />} title="You have accepted this proposal" body={`Accepted on ${view.accepted_at ? dateTime.format(new Date(view.accepted_at)) : '—'}. Thank you — our team will contact you about the next steps.`} testId="state-accepted" />
      )}
      {view.state === 'declined' && (
        <Message icon={<XCircle className="h-10 w-10 text-[#111827]/50" />} title="You declined this proposal" body="Thank you for letting us know. If you change your mind or want a different option, please contact Grid Nova." testId="state-declined" />
      )}
      {view.state === 'open' && <Decide token={token} mobileHint={view.mobile_hint} onState={onState} />}
    </div>
  )
}

function Decide({ token, mobileHint, onState }: { token: string; mobileHint: string | null; onState: (s: PublicState, patch?: Partial<PublicProposal>) => void }) {
  const [name, setName] = useState('')
  const [last4, setLast4] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<{ field: 'name' | 'last4' | 'terms' | null; message: string } | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  function refused(e: unknown): boolean {
    const code = e instanceof ApiError ? (e.structuredDetail?.code as string | undefined) : undefined
    if (code === 'proposal_expired') onState('expired')
    else if (code === 'proposal_superseded') onState('superseded')
    else if (code === 'proposal_declined') onState('declined')
    else return false
    return true
  }

  async function accept(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError({ field: 'name', message: 'Please type your full name.' })
    if (!/^\d{4}$/.test(last4)) return setError({ field: 'last4', message: 'Please type the last 4 digits of your mobile number.' })
    if (!agree) return setError({ field: 'terms', message: 'Please tick the box to confirm you accept.' })
    setBusy('accept')
    setError(null)
    try {
      const r = await acceptPublicProposal(token, { full_name: name.trim(), mobile_last4: last4, accept_terms: true })
      onState('accepted', { accepted_at: r.accepted_at })
    } catch (x) {
      if (refused(x)) return
      const code = x instanceof ApiError ? (x.structuredDetail?.code as string | undefined) : undefined
      if (code === 'mobile_mismatch') setError({ field: 'last4', message: 'These are not the last 4 digits of the mobile number on the proposal. Please check and try again.' })
      else if (code === 'terms_not_accepted') setError({ field: 'terms', message: 'Please tick the box to confirm you accept.' })
      else if (x instanceof ApiError && x.status === 429) setError({ field: null, message: 'Too many tries. Please wait a minute and try again.' })
      else setError({ field: null, message: 'We could not record your acceptance. Please try again, or contact Grid Nova.' })
    } finally {
      setBusy(null)
    }
  }

  async function decline() {
    setBusy('decline')
    setError(null)
    try {
      await declinePublicProposal(token, reason.trim() || null)
      onState('declined')
    } catch (x) {
      if (!refused(x)) setError({ field: null, message: 'We could not record this. Please try again, or contact Grid Nova.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-[#091c3c]">Accept this proposal</h2>
      <p className="mt-1 font-utility text-sm text-[#111827]/70">Accepting tells Grid Nova to go ahead. Our team will then contact you about the agreement and the first payment.</p>
      <form onSubmit={accept} className="mt-4 space-y-4" noValidate data-testid="accept-form">
        <div>
          <label htmlFor="accept-name" className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">Your full name</label>
          <input id="accept-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" aria-invalid={error?.field === 'name' || undefined} aria-describedby={error?.field === 'name' ? 'accept-error' : undefined} />
        </div>
        <div>
          <label htmlFor="accept-last4" className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">Last 4 digits of your mobile number</label>
          <input id="accept-last4" className={FIELD} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} autoComplete="off" aria-invalid={error?.field === 'last4' || undefined} aria-describedby={['accept-last4-hint', error?.field === 'last4' ? 'accept-error' : ''].filter(Boolean).join(' ')} />
          <p id="accept-last4-hint" className="mt-1 font-utility text-xs text-[#111827]/60">The mobile number on the proposal{mobileHint ? ` (${mobileHint})` : ''}.</p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#0e2a63]" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-invalid={error?.field === 'terms' || undefined} />
          <span className="font-utility text-sm text-[#111827]">I accept this proposal and its terms</span>
        </label>
        {error && <p id="accept-error" role="alert" className="font-utility text-sm text-red-700">{error.message}</p>}
        <button type="submit" disabled={!!busy} className={`${BUTTON} bg-[#f7a800] text-[#091c3c] hover:bg-[#ffb81f]`} data-testid="accept-submit">
          {busy === 'accept' && <Loader2 className="h-4 w-4 animate-spin" />} Accept the proposal
        </button>
      </form>

      <div className="mt-6 border-t border-[#eef1f5] pt-4">
        {!declining ? (
          <button type="button" onClick={() => setDeclining(true)} className="inline-flex min-h-11 items-center font-utility text-sm text-[#111827]/70 underline underline-offset-2" data-testid="decline-open">
            I do not want to go ahead
          </button>
        ) : (
          <div className="space-y-3" data-testid="decline-form">
            <label htmlFor="decline-reason" className="block font-utility text-sm font-medium text-[#091c3c]">Would you tell us why? (optional)</label>
            <textarea id="decline-reason" className={FIELD} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void decline()} disabled={!!busy} className={`${BUTTON} border border-[#e4e8ee] text-[#091c3c] hover:bg-[#f7f9fc]`} data-testid="decline-submit">
                {busy === 'decline' && <Loader2 className="h-4 w-4 animate-spin" />} Decline the proposal
              </button>
              <button type="button" onClick={() => setDeclining(false)} className={`${BUTTON} text-[#0e2a63]`}>Keep it open</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function Contact() {
  const offices = [
    { name: 'Kolkata office', a: localBusinessSchema.address, phone: HELPLINE_DISPLAY, tel: HELPLINE_TEL },
    { name: 'Patna office', a: patnaLocalBusinessSchema.address, phone: '+91 91995 76535', tel: `tel:${patnaLocalBusinessSchema.telephone.replace(/-/g, '')}` },
  ]
  return (
    <section aria-label="Contact Grid Nova" className="mt-5 rounded-2xl border border-[#e4e8ee] bg-white p-6" data-testid="public-contact">
      <h2 className="font-display text-base font-semibold text-[#091c3c]">Questions? Talk to us</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {offices.map((o) => (
          <div key={o.name} className="font-utility text-sm text-[#111827]/80">
            <p className="font-semibold text-[#091c3c]">{o.name}</p>
            <p className="mt-1 flex gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8a5a00]" aria-hidden="true" />{o.a.streetAddress}, {o.a.addressLocality} – {o.a.postalCode}, {o.a.addressRegion}</p>
            <a href={o.tel} className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[#0e2a63] underline-offset-2 hover:underline"><Phone className="h-4 w-4" aria-hidden="true" />{o.phone}</a>
          </div>
        ))}
      </div>
      <p className="mt-2 font-utility text-sm">
        Email <a className="text-[#0e2a63] underline-offset-2 hover:underline" href="mailto:info@gridnova.in">info@gridnova.in</a>
      </p>
    </section>
  )
}
