'use client'

import { useState } from 'react'
import { Download, Phone, Mail } from 'lucide-react'
import ServiceRequestForm from '@/components/handover/ServiceRequestForm'
import { ApiError } from '@/lib/dashboard/api-error'
import { publicFetch } from '@/lib/api/http'
import { formatDate } from '@/lib/dashboard/utils'
import { ENGLISH_SERVICE_FORM_COPY } from '@/lib/handover/form-copy'
import { CATEGORY_LABEL, STATUS_LABEL, handoverErrorMessage } from '@/lib/handover/labels'
import { categoryKeys, publicHandoverPath, publicPdfHref } from '@/lib/handover/public'
import { publicRequestsSchema, type PublicHandover, type ServiceRequest } from '@/lib/handover/schemas'
import { buildServiceRequestForm, DEFAULT_MAX_PHOTOS, type ServiceRequestInput } from '@/lib/handover/service-request-form'

function publicErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'This link is no longer valid. Please contact Grid Nova for a new one.'
    if (err.status === 429) return 'You have sent several requests recently. Please wait a few minutes and try again, or call us.'
  }
  return handoverErrorMessage(err)
}

const card = 'rounded-2xl border border-[#e4e8ee] bg-white p-6 md:p-9 shadow-[0_20px_60px_-24px_rgba(9,28,60,0.25)]'
const h2 = 'font-display text-lg font-semibold text-[#091c3c]'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <dt className="font-utility text-xs text-[#111827]/65">{label}</dt>
      <dd className="font-utility text-sm text-[#111827]">{children}</dd>
    </div>
  )
}

/** The customer's page: system, warranty, the pack to download and a way to ask for service. */
export default function HandoverView({ token, view, initialRequests }: { token: string; view: PublicHandover; initialRequests: ServiceRequest[] | null }) {
  // The list arrives with the page (fetched on the server); it is refetched after each request is sent.
  const [requests, setRequests] = useState<ServiceRequest[] | null>(initialRequests)
  const [loadError, setLoadError] = useState<string | null>(initialRequests === null ? 'We could not load your earlier requests.' : null)

  async function load() {
    try {
      const r = await publicFetch(`${publicHandoverPath(token)}/service-requests`, undefined, publicRequestsSchema)
      setRequests(r.items)
      setLoadError(null)
    } catch (err) {
      setLoadError(publicErrorMessage(err))
    }
  }

  const keys = categoryKeys(view)
  const formCopy = { ...ENGLISH_SERVICE_FORM_COPY, categories: Object.fromEntries(keys.map((k) => [k, ENGLISH_SERVICE_FORM_COPY.categories[k] ?? CATEGORY_LABEL[k] ?? k])) }
  const w = view.warranty
  const service = view.service

  async function raise(input: ServiceRequestInput) {
    // Multipart without a bearer token: the link is the credential.
    await publicFetch(`${publicHandoverPath(token)}/service-requests`, { method: 'POST', body: buildServiceRequestForm(input) })
    await load()
  }

  return (
    <div className="space-y-5" data-testid="public-handover">
      <div className={card}>
        <h1 className="font-display text-2xl font-semibold text-[#091c3c]">{view.customer_name ? `Welcome, ${view.customer_name}` : 'Your solar system'}</h1>
        <p className="mt-2 font-utility text-sm leading-relaxed text-[#111827]/65">Your Grid Nova solar system has been handed over. Here are your warranty details, your handover pack, and a way to reach us if something is wrong.</p>
        <dl className="mt-4 divide-y divide-[#e4e8ee]">
          {view.project_reference_id && <Row label="Project">{view.project_reference_id}</Row>}
          {view.site_address && <Row label="Site">{view.site_address}</Row>}
          {view.system?.installed_module_kw != null && <Row label="Installed capacity">{String(view.system.installed_module_kw)} kW{view.system.connection_phase ? ` · ${view.system.connection_phase} phase` : ''}</Row>}
        </dl>
        {view.pdf_available ? (
          <a
            href={publicPdfHref(token)}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#e4e8ee] px-6 py-3 font-utility text-sm font-semibold text-[#0e2a63] transition-colors hover:bg-[#f7f9fc] focus-visible:outline-2 focus-visible:outline-[#f7a800]"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download your handover pack (PDF)
          </a>
        ) : (
          <p className="mt-5 rounded-xl bg-[#f7f9fc] px-4 py-3 font-utility text-sm text-[#111827]/70" data-testid="pdf-pending">Your handover pack is being prepared. It will appear here as soon as it is ready.</p>
        )}
      </div>

      {w && (
        <div className={card} data-testid="public-warranty">
          <h2 className={h2}>Your warranty</h2>
          <dl className="mt-2 divide-y divide-[#e4e8ee]">
            <Row label="System warranty">
              {w.system.years != null && w.system.starts && w.system.ends ? `${w.system.years} years — ${formatDate(w.system.starts)} to ${formatDate(w.system.ends)}` : 'To be confirmed'}
              {w.system.active != null && <span className={`ml-2 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${w.system.active ? 'bg-emerald-100 text-emerald-800' : 'bg-[#111827]/10 text-[#111827]/70'}`}>{w.system.active ? 'In warranty' : 'Warranty ended'}</span>}
            </Row>
            <Row label="Free operations & maintenance">{w.om.free_months != null && w.om.free_until ? `${w.om.free_months} months, until ${formatDate(w.om.free_until)}` : 'To be confirmed'}</Row>
            <Row label="Maintenance after the free period">{w.om.terms_after_free_period ?? 'To be confirmed'}</Row>
            <Row label="Expected panel performance life">{w.panel_performance_life_years != null ? `${w.panel_performance_life_years} years (a life span, not a warranty)` : 'To be confirmed'}</Row>
          </dl>
          {w.units.length > 0 && (
            <>
              <h3 className="mt-4 font-utility text-sm font-semibold text-[#091c3c]">Your equipment</h3>
              <ul className="mt-2 space-y-2">
                {w.units.map((u, i) => (
                  <li key={u.unit_id ?? `${u.serial_number}-${i}`} className="rounded-xl bg-[#f7f9fc] p-3 font-utility text-sm" data-testid="public-unit">
                    <p className="font-medium capitalize text-[#091c3c]">{u.category}{[u.make, u.model].filter(Boolean).length ? ` · ${[u.make, u.model].filter(Boolean).join(' ')}` : ''}</p>
                    {u.serial_number && <p className="text-xs text-[#111827]/65">Serial {u.serial_number}</p>}
                    <p className="text-xs text-[#111827]/65">{u.warranty_end ? `Warranty until ${formatDate(u.warranty_end)}` : 'Warranty date to be confirmed'}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className={card}>
        <h2 className={h2}>Need service?</h2>
        {(service.phone || service.email) && (
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-utility text-sm text-[#111827]/70" data-testid="service-contact">
            {service.phone && <a className="inline-flex min-h-11 items-center gap-1.5 text-[#0e2a63] hover:underline" href={`tel:${service.phone.replace(/\s+/g, '')}`}><Phone className="h-4 w-4" aria-hidden="true" /> {service.phone}</a>}
            {service.email && <a className="inline-flex min-h-11 items-center gap-1.5 text-[#0e2a63] hover:underline" href={`mailto:${service.email}`}><Mail className="h-4 w-4" aria-hidden="true" /> {service.email}</a>}
          </p>
        )}
        {service.sla_hours != null && <p className="mt-1 font-utility text-xs text-[#111827]/65">We aim to resolve a request within {service.sla_hours} hours.</p>}
        <div className="mt-4">
          <ServiceRequestForm copy={formCopy} maxPhotos={service.max_photos ?? DEFAULT_MAX_PHOTOS} onSubmit={raise} describeError={publicErrorMessage} />
        </div>
      </div>

      <div className={card} aria-live="polite">
        <h2 className={h2}>Your service requests</h2>
        {loadError ? (
          <p className="mt-2 font-utility text-sm text-red-700" role="alert">{loadError}</p>
        ) : requests === null ? (
          <p className="mt-2 font-utility text-sm text-[#111827]/65">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="mt-2 font-utility text-sm text-[#111827]/65" data-testid="public-no-requests">You have not sent any service requests.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {requests.map((r) => (
              <li key={r.request_id} className="rounded-xl border border-[#e4e8ee] p-3 font-utility text-sm" data-testid="public-request">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#091c3c]">{CATEGORY_LABEL[r.category] ?? r.category}</p>
                  <span className="rounded-full bg-[#2f5daa]/10 px-2.5 py-1 text-xs font-semibold text-[#0e2a63]">{STATUS_LABEL[r.status] ?? r.status}</span>
                </div>
                <p className="mt-1 text-[#111827]">{r.description}</p>
                <p className="mt-1 text-xs text-[#111827]/65">Sent {formatDate(r.created_at)}</p>
                {r.resolution_note && <p className="mt-1 text-[#111827]/80">Outcome: {r.resolution_note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="px-1 text-center font-utility text-xs text-[#111827]/65">
        Questions? Email{' '}
        <a href="mailto:info@gridnova.in" className="inline-flex min-h-11 items-center font-medium text-[#0e2a63] hover:underline focus-visible:outline-2 focus-visible:outline-[#f7a800]">info@gridnova.in</a>
      </p>
    </div>
  )
}
