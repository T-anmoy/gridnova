'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft, Check, Circle, Download } from 'lucide-react'
import Link from '@/components/i18n/Link'
import ServiceRequestForm from '@/components/handover/ServiceRequestForm'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { notAuthenticatedError } from '@/lib/api/http'
import { humanize } from '@/lib/associate/execution-labels'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { fetchMyHandoverPdfLink, useMyHandoverPack, useMyServiceRequests, useRaiseMyServiceRequest } from '@/lib/handover/associate-api-client'
import type { ServiceFormCopy } from '@/lib/handover/form-copy'
import type { Warranty, ServiceRequest } from '@/lib/handover/schemas'
import { DEFAULT_MAX_PHOTOS } from '@/lib/handover/service-request-form'
import { fmt, type Messages } from '@/lib/i18n/types'

type Copy = Messages['associates']['portal']['handover']
type ServiceWords = Messages['associates']['portal']['feed']['service']
type Portal = '/associates/portal' | '/preferred/portal'

const CARD = 'rounded-2xl border border-[#e4e8ee] bg-white p-5'
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]'

const word = (words: Record<string, string>, key: string) => words[key] ?? humanize(key)

function WarrantyCard({ warranty, copy }: { warranty: Warranty; copy: Copy['warranty'] }) {
  const sys = warranty.system
  const om = warranty.om
  const unconfirmed = <span className="rounded-full bg-amber-100 px-2 py-0.5 font-utility text-xs font-semibold text-amber-900" data-testid="unconfirmed">{copy.unconfirmed}</span>
  const cats = copy.categories as Record<string, string>
  return (
    <section className={CARD} aria-labelledby="warranty-h" data-testid="warranty-card">
      <h2 id="warranty-h" className="font-display text-base font-semibold text-[#0e2a63]">{copy.title}</h2>
      {warranty.handover_date && <p className="mt-1 font-utility text-xs text-[#111827]/70">{fmt(copy.handedOver, { date: formatDate(warranty.handover_date) })}</p>}
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="font-utility text-xs text-[#111827]/65">{copy.system}</dt>
          <dd>
            {sys.years != null && sys.starts && sys.ends ? fmt(copy.systemRange, { years: sys.years, from: formatDate(sys.starts), to: formatDate(sys.ends) }) : unconfirmed}
            {sys.active != null && (
              <span className={`ml-2 inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-utility text-xs font-semibold ${sys.active ? 'bg-emerald-100 text-emerald-800' : 'bg-[#111827]/10 text-[#111827]/70'}`}>
                {sys.active ? copy.inWarranty : copy.ended}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-utility text-xs text-[#111827]/65">{copy.om}</dt>
          <dd>{om.free_months != null && om.free_until ? fmt(copy.omRange, { months: om.free_months, date: formatDate(om.free_until) }) : unconfirmed}</dd>
        </div>
        <div>
          <dt className="font-utility text-xs text-[#111827]/65">{copy.omAfter}</dt>
          <dd>{om.terms_after_free_period ? om.terms_after_free_period : unconfirmed}</dd>
        </div>
        <div>
          <dt className="font-utility text-xs text-[#111827]/65">{copy.panelLife}</dt>
          <dd>{warranty.panel_performance_life_years != null ? fmt(copy.panelLifeValue, { years: warranty.panel_performance_life_years }) : unconfirmed}</dd>
        </div>
      </dl>
      {warranty.units.length > 0 && (
        <div className="mt-4">
          <h3 className="font-utility text-sm font-semibold text-[#091c3c]">{copy.units}</h3>
          <ul className="mt-2 space-y-2">
            {warranty.units.map((u, i) => (
              <li key={u.unit_id ?? `${u.serial_number}-${i}`} className="rounded-xl bg-[#f7f9fc] p-3 text-sm" data-testid="warranty-unit">
                <p className="font-medium text-[#091c3c]">{cats[u.category] ?? humanize(u.category)}{[u.make, u.model].filter(Boolean).length > 0 ? ` · ${[u.make, u.model].filter(Boolean).join(' ')}` : ''}</p>
                {u.serial_number && <p className="font-utility text-xs text-[#111827]/70">{fmt(copy.serial, { serial: u.serial_number })}</p>}
                <p className="font-utility text-xs text-[#111827]/70">{u.warranty_end ? fmt(copy.unitEnds, { date: formatDate(u.warranty_end) }) : copy.unitNoDate}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function RequestList({ items, copy, words, focus }: { items: ServiceRequest[]; copy: Copy['requests']; words: ServiceWords; focus: number | null }) {
  const chip = copy.statusChip as Record<string, string>
  const focused = useRef<HTMLLIElement>(null)
  useEffect(() => {
    focused.current?.scrollIntoView?.({ block: 'center' })
  }, [focus])
  if (items.length === 0) return <p className="mt-3 font-utility text-sm text-[#111827]/70" data-testid="no-requests">{copy.empty}</p>
  return (
    <ul className="mt-3 space-y-3" aria-label={copy.title}>
      {items.map((r) => (
        <li
          key={r.request_id}
          ref={focus === r.request_id ? focused : undefined}
          className={`rounded-xl border p-3 ${focus === r.request_id ? 'border-[#f7a800] ring-2 ring-[#f7a800]/30' : 'border-[#e4e8ee]'}`}
          data-testid="service-request-item"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm font-semibold text-[#091c3c]">#{r.request_id} · {word(words.categories, r.category)}</p>
            <span className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#2f5daa]/10 px-2.5 py-1 font-utility text-xs font-semibold text-[#0e2a63]">{chip[r.status] ?? humanize(r.status)}</span>
              {r.within_warranty === true && <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-utility text-xs font-semibold text-emerald-800" data-testid="within-warranty">{copy.withinWarranty}</span>}
              {r.within_warranty === false && <span className="rounded-full bg-[#111827]/10 px-2.5 py-1 font-utility text-xs font-semibold text-[#111827]/70" data-testid="out-of-warranty">{copy.outOfWarranty}</span>}
            </span>
          </div>
          <p className="mt-1 line-clamp-3 text-sm text-[#111827]">{r.description}</p>
          <p className="mt-1 font-utility text-xs text-[#111827]/65">{fmt(copy.raisedOn, { date: formatDate(r.created_at) })}</p>
          {r.resolution_note && <p className="mt-1 text-sm text-[#111827]/80">{fmt(copy.resolution, { note: r.resolution_note })}</p>}
        </li>
      ))}
    </ul>
  )
}

export default function PortalHandover({ onboardingId, portalBase, copy, words }: { onboardingId: number; portalBase: Portal; copy: Copy; words: ServiceWords }) {
  const sp = useSearchParams()
  const focus = Number(sp.get('request')) || null
  const { getToken } = useAuth()
  const { data: pack, isLoading, error, refetch } = useMyHandoverPack(onboardingId)
  const requests = useMyServiceRequests(onboardingId)
  const raise = useRaiseMyServiceRequest(onboardingId)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const back = (
    <Link href={`${portalBase}/customers/${onboardingId}`} className={`inline-flex min-h-[44px] items-center gap-1.5 font-utility text-sm font-semibold text-[#0e2a63] ${FOCUS}`}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.back}
    </Link>
  )

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-busy="true">
        {back}
        <div className="h-32 animate-pulse rounded-2xl bg-[#eef1f6]" />
        <span className="sr-only">{copy.loading}</span>
      </div>
    )
  }
  if (error) {
    const notStarted = error instanceof ApiError && (error.structuredDetail?.code === 'execution_not_started' || error.status === 404)
    return (
      <div className="space-y-4">
        {back}
        {notStarted ? (
          <div className={CARD} data-testid="not-started">
            <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.notStartedTitle}</p>
            <p className="mt-1 text-sm text-[#111827]/70">{copy.notStartedBody}</p>
          </div>
        ) : (
          <DashboardError error={error} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }
  if (!pack) return null

  const items = copy.pack.items as Record<string, string>
  const missing = pack.items.filter((i) => !i.done)

  async function downloadPdf() {
    setPdfError(null)
    try {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      // A signed URL expires: fetch a fresh one on every click.
      const link = await fetchMyHandoverPdfLink(onboardingId, token)
      window.open(link.url, '_blank', 'noopener')
    } catch (err) {
      setPdfError(err instanceof ApiError && err.status === 404 ? copy.pdf.notReady : copy.pdf.error)
    }
  }

  const raiseError = (err: unknown) => {
    const code = err instanceof ApiError && typeof err.structuredDetail?.code === 'string' ? err.structuredDetail.code : ''
    return (copy.requests.errors as Record<string, string>)[code] ?? copy.requests.errors.generic
  }
  const formCopy: ServiceFormCopy = { ...copy.form, categories: words.categories }

  return (
    <div className="space-y-5 pb-6">
      {back}
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>

      <section className={CARD} aria-labelledby="pack-h" data-testid="pack-card">
        <h2 id="pack-h" className="font-display text-base font-semibold text-[#0e2a63]">{copy.pack.title}</h2>
        <p className="mt-1 font-utility text-sm text-[#111827]/75">
          {pack.handover_recorded ? copy.pack.handedOver : pack.complete ? copy.pack.complete : fmt(copy.pack.progress, { done: pack.done, total: pack.total })}
        </p>
        <ul className="mt-3 space-y-2" aria-label={copy.pack.title}>
          {pack.items.map((i) => (
            <li key={i.key} className="flex items-start gap-2 text-sm" data-testid={`pack-item-${i.key}`} data-done={i.done ? 'true' : 'false'}>
              {i.done ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-label={copy.pack.done} /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#111827]/50" aria-label={copy.pack.notDone} />}
              <span>{items[i.key] ?? items.generic}</span>
            </li>
          ))}
        </ul>
        {!pack.handover_recorded && missing.length > 0 && (
          <Link href={`${portalBase}/customers/${onboardingId}/execution`} className={`mt-3 inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#0e2a63] underline ${FOCUS}`}>
            {copy.pack.openExecution}
          </Link>
        )}
      </section>

      {pack.handover_recorded && (
        <section className={CARD} aria-labelledby="pdf-h">
          <h2 id="pdf-h" className="font-display text-base font-semibold text-[#0e2a63]">{copy.pdf.title}</h2>
          {pack.pdf.status === 'ready' ? (
            <button type="button" onClick={() => void downloadPdf()} className={`mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#0e2a63] px-5 font-utility text-sm font-semibold text-white ${FOCUS}`}>
              <Download className="h-4 w-4" aria-hidden="true" /> {copy.pdf.download}
            </button>
          ) : (
            <p className="mt-2 text-sm text-[#111827]/70" data-testid="pdf-not-ready">{copy.pdf.notReady}</p>
          )}
          <p role="alert" className={pdfError ? 'mt-2 font-utility text-sm text-red-700' : 'sr-only'}>{pdfError}</p>
        </section>
      )}

      {pack.warranty && <WarrantyCard warranty={pack.warranty} copy={copy.warranty} />}

      <section className={CARD} aria-labelledby="requests-h" id="service-requests">
        <h2 id="requests-h" className="font-display text-base font-semibold text-[#0e2a63]">{copy.requests.title}</h2>
        {requests.error ? (
          <div className="mt-3"><DashboardError error={requests.error} onRetry={() => void requests.refetch()} /></div>
        ) : requests.isLoading ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#eef1f6]" role="status" aria-busy="true"><span className="sr-only">{copy.loading}</span></div>
        ) : (
          <RequestList items={requests.data?.items ?? []} copy={copy.requests} words={words} focus={focus} />
        )}
      </section>

      {pack.handover_recorded ? (
        pack.can_raise_service_request ? (
          <section className={CARD} aria-labelledby="raise-h">
            <h2 id="raise-h" className="mb-3 font-display text-base font-semibold text-[#0e2a63]">{copy.requests.raiseTitle}</h2>
            <ServiceRequestForm copy={formCopy} maxPhotos={DEFAULT_MAX_PHOTOS} onSubmit={(input) => raise.mutateAsync(input)} describeError={raiseError} />
          </section>
        ) : (
          <p className="font-utility text-sm text-[#111827]/70" data-testid="owner-only">{copy.requests.ownerOnly}</p>
        )
      ) : (
        <p className="font-utility text-sm text-[#111827]/70" data-testid="not-handed-over">{copy.requests.notHandedOver}</p>
      )}
    </div>
  )
}
