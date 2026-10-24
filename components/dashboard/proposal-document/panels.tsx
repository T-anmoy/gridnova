'use client'

import { AlertTriangle, History, IndianRupee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatInr } from '@/lib/money'
import {
  PRICE_MODE_LABEL,
  SECTION_TITLES,
  changeText,
  fieldAnchorId,
  isDocumentSection,
  sectionAnchorId,
  sectionOfField,
} from '@/lib/proposals/document-logic'
import type { DocumentFigures, MissingField, Price, Signatory } from '@/lib/proposals/document-types'
import { ComputedValue, FixedValue } from './fields'

/** Scroll to a backend field path and focus it; falls back to its section. */
export function focusField(field: string): void {
  if (typeof document === 'undefined') return
  const section = sectionOfField(field)
  const el = document.getElementById(fieldAnchorId(field)) ?? (section ? document.getElementById(sectionAnchorId(section)) : null)
  if (!el) return
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  const focusable = el.matches('input,select,textarea,button,[tabindex]') ? el : el.querySelector<HTMLElement>('input,select,textarea,button')
  ;(focusable ?? el).focus?.({ preventScroll: true })
}

/** The backend's `gst_rate` fraction as a percent for the label (shown, never used to compute). */
function rateText(rate: string): string {
  const n = Number(rate)
  return Number.isFinite(n) ? (n * 100).toFixed(2).replace(/\.?0+$/, '') : rate
}

export function MissingList({ missing, title = 'Still needed before approval' }: { missing: MissingField[]; title?: string }) {
  if (!missing.length) return null
  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="missing-required">
      <p className="flex items-center gap-2 font-utility text-sm font-medium text-amber-900">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {title}
      </p>
      <ul className="mt-2 space-y-1">
        {missing.map((m) => {
          const section = sectionOfField(m.field)
          return (
            <li key={m.field}>
              <button type="button" className="text-left font-utility text-sm text-[#0e2a63] underline underline-offset-2 hover:text-[#091c3c]" onClick={() => focusField(m.field)}>
                {m.message.charAt(0).toUpperCase() + m.message.slice(1)}
              </button>
              {section && <span className="font-utility text-xs text-amber-800"> — {SECTION_TITLES[section]}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The price is never typed in the document: it comes from the price list or Adjust Price. */
export function PriceSummary({ figures, price, onAdjust }: { figures: DocumentFigures | null | undefined; price: Price | undefined; onAdjust?: () => void }) {
  const mode = figures?.price_mode ?? price?.mode ?? 'none'
  return (
    <div id={fieldAnchorId('price')} tabIndex={-1} className="space-y-3 rounded-lg border border-[#e4e8ee] bg-[#fbfcfe] p-3 outline-none" data-testid="price-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-utility text-sm font-medium text-[#091c3c]">
          Price <span className="font-normal text-[#111827]/65">· {PRICE_MODE_LABEL[mode] ?? mode}</span>
          {price?.price_list_version != null && mode === 'price_list' && <span className="font-normal text-[#111827]/65"> (version {price.price_list_version})</span>}
        </p>
        {onAdjust && (
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onAdjust}>
            <IndianRupee className="mr-1.5 h-3.5 w-3.5" /> Adjust Price
          </Button>
        )}
      </div>
      {mode === 'none' || !figures?.total ? (
        <p className="font-utility text-sm text-amber-800">No price yet. {onAdjust ? 'Set one with Adjust Price.' : 'Admin or Sales sets it with Adjust Price.'}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <ComputedValue label="Basic" value={formatInr(figures.basic)} hint={mode === 'price_list' ? 'from price list' : 'set by staff'} />
            <ComputedValue label={`GST (${rateText(figures.gst_rate)} %)`} value={formatInr(figures.gst)} />
            <ComputedValue label="Total incl. GST" value={formatInr(figures.total)} />
          </div>
          {figures.words.total && <ComputedValue label="In words" value={figures.words.total} />}
          {figures.payments.length > 0 && (
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-2" data-state="computed">
              <p className="font-utility text-[11px] text-[#111827]/60">Payment schedule · calculated</p>
              <ul className="mt-1 space-y-0.5">
                {figures.payments.map((p, i) => (
                  <li key={i} className="flex justify-between gap-2 font-utility text-sm">
                    <span>
                      {p.percent} % — {p.label}
                    </span>
                    <span className="font-medium">{formatInr(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {figures.subsidy.applies && (
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-2" data-state="computed" data-testid="subsidy">
              <p className="font-utility text-[11px] text-[#111827]/60">PM Surya Ghar subsidy · calculated</p>
              <ul className="mt-1 space-y-0.5">
                {figures.subsidy.slabs.map((s, i) => (
                  <li key={i} className="flex justify-between gap-2 font-utility text-sm">
                    <span>
                      {s.kw} kW × {formatInr(s.rate)}
                    </span>
                    <span>{formatInr(s.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 flex justify-between font-utility text-sm font-medium">
                <span>Subsidy</span> <span>{formatInr(figures.subsidy.total)}</span>
              </p>
              <p className="flex justify-between font-utility text-sm font-medium">
                <span>Effective cost</span> <span>{formatInr(figures.subsidy.effective_cost)}</span>
              </p>
            </div>
          )}
        </>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {figures?.generation.monthly_units != null && (
          <ComputedValue label="Generation" value={`${figures.generation.monthly_units} units/month · ${figures.generation.annual_units ?? '—'} units/year`} />
        )}
        {figures?.space_required_sqft && (
          <ComputedValue
            label="Roof area needed"
            value={figures.layout === 'detailed' ? `${figures.space_required_sqft.single} sq ft` : `${figures.space_required_sqft.low}–${figures.space_required_sqft.high} sq ft`}
          />
        )}
        {figures && <ComputedValue label="Validity" value={`${figures.validity_days} days`} hint="from sales policy" />}
      </div>
    </div>
  )
}

/** The frame that is the same on every proposal. Nothing here is editable through the dashboard. */
export function FixedParts({ signatory }: { signatory: Signatory | null | undefined }) {
  return (
    <details className="rounded-xl border border-[#e4e8ee] bg-white" data-testid="fixed-parts">
      <summary className="cursor-pointer px-4 py-3 font-display text-base font-semibold text-[#091c3c]">Fixed on every proposal</summary>
      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
        <FixedValue label="Header band and watermark on every page" />
        <FixedValue label="Page footer line with page numbers" />
        <FixedValue label="Letterhead band and QR code on the last page" />
        <FixedValue label="Company letter paragraphs and quality policy" />
        <FixedValue label="Warranty rows" />
        <FixedValue label="GST rule" />
        <FixedValue label="Legal and subsidy notes" />
        <FixedValue
          label="Signatory"
          value={signatory ? `${signatory.name}, ${signatory.title} — ${signatory.for_line}` : undefined}
        />
      </div>
    </details>
  )
}

export interface SessionChange {
  id: string
  section: string
  field: string
  before: unknown
  after: unknown
  at: string
}

/**
 * Edits saved in this browser session, from each PATCH response's `changes`.
 * The backend audits every edit, but publishes no route that lists them.
 */
export function SessionChanges({ changes }: { changes: SessionChange[] }) {
  return (
    <section aria-label="Changes in this session" className="rounded-xl border border-[#e4e8ee] bg-white p-4" data-testid="session-changes">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold text-[#091c3c]">
        <History className="h-4 w-4" aria-hidden="true" /> Changes in this session
      </h3>
      {changes.length === 0 ? (
        <p className="mt-1 font-utility text-sm text-[#111827]/60">Nothing saved yet in this session.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {changes.map((c) => (
            <li key={c.id} className="font-utility text-sm">
              <span className="font-medium text-[#091c3c]">{isDocumentSection(c.section) ? SECTION_TITLES[c.section] : c.section}</span>{' '}
              <code className="text-xs text-[#111827]/65">{c.field}</code>:{' '}
              <span className="text-[#111827]/65 line-through decoration-[#111827]/30">{changeText(c.before)}</span> → <span>{changeText(c.after)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-utility text-[11px] text-[#111827]/55">The server also records every saved change in its audit trail.</p>
    </section>
  )
}
