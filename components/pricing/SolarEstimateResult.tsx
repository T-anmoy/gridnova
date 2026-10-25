'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import { fmt, type Messages } from '@/lib/i18n/types'
import { formatGrouped, formatInr, isPositiveAmount } from '@/lib/money'
import { orderedPackageIds, type PackageCatalogue, type PackagePrice } from '@/lib/pricing/price-list'
import { figuresKw, type SizeOption, type SolarEstimate, type SubsidyBreakdown } from '@/lib/pricing/solar-estimate'
import { CustomQuoteNotice, PriceListSummary } from '@/components/pricing/PackageCards'
import HowWeCalculate from '@/components/pricing/HowWeCalculate'
import { usePackageCatalogue } from '@/lib/pricing/usePackageCatalogue'
import { StatusBadge, useIsoDate } from '@/components/pricing/StatusBadge'

// One result for every screen that shows a BE-14 estimate — the public
// calculator, the associate's estimate and the survey results — so the
// associate shows the customer exactly what the website shows. Every number
// is the backend's own string; this file only picks words and lays them out.

type EstimateCopy = Messages['pricing']['estimate']

const firstPackage = (packages: Record<string, PackagePrice>) => {
  const id = orderedPackageIds(Object.keys(packages))[0]
  return id ? { id, price: packages[id] } : null
}

function Stat({ label, value, sub, testId, wide }: { label: string; value: ReactNode; sub?: ReactNode; testId?: string; wide?: boolean }) {
  return (
    <div data-testid={testId} className={`min-w-0 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <dt className="font-utility text-[11px] uppercase tracking-[0.08em] text-white/70">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-semibold leading-tight text-white">{value}</dd>
      {sub && <dd className="mt-0.5 font-utility text-xs leading-snug text-white/70">{sub}</dd>}
    </div>
  )
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="rounded-xl border border-[#e4e8ee] bg-white p-4">
      <h3 className="font-display text-base font-semibold text-[#0e2a63]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Row({ label, value, strong, testId }: { label: ReactNode; value: ReactNode; strong?: boolean; testId?: string }) {
  return (
    <div data-testid={testId} className="flex items-baseline justify-between gap-3 py-1">
      <dt className="min-w-0 font-utility text-sm text-[#111827]/75">{label}</dt>
      <dd className={`shrink-0 text-right ${strong ? 'font-display text-lg font-semibold text-[#0e2a63]' : 'font-utility text-sm font-semibold text-[#0e2a63]'}`}>{value}</dd>
    </div>
  )
}

function Summary({ e, t, hidePrices }: { e: SolarEstimate; t: EstimateCopy; hidePrices?: boolean }) {
  const p = useMessages('pricing')
  const kw = figuresKw(e)
  const basisKey = e.roof_limited ? 'roof_area' : e.sizing_basis
  const basis = basisKey ? (t.basis as Record<string, string>)[basisKey] : undefined
  const exact = e.recommended_kw_exact != null ? String(e.recommended_kw_exact) : null
  const priced = e.priced_kw != null ? String(e.priced_kw) : null
  const assured = e.price_status === 'list_price' && !hidePrices ? firstPackage(e.packages) : null
  const confidence = e.confidence
  const reasonKey = e.savings ? e.savings.tariff_source : 'none'
  const reason = (t.confidence.reason as Record<string, string>)[reasonKey]
  return (
    <div data-testid="estimate-summary" className="rounded-2xl bg-[#0e2a63] p-5 text-white">
      <p className="font-utility text-[11px] uppercase tracking-[0.08em] text-white/70">{t.summary.size}</p>
      {kw && (
        <p data-testid="recommended-kw" className="font-display text-3xl font-semibold leading-tight">
          {fmt(t.summary.kw, { kw })}
        </p>
      )}
      {basis && (
        <p data-testid="sizing-basis" className="mt-1 font-utility text-sm text-white/80">
          {fmt(basis, { units: formatGrouped(e.monthly_units_used) })}
        </p>
      )}
      {e.priced_kw_differs && exact && priced && (
        <p data-testid="snapped-note" className="mt-1 font-utility text-xs text-white/70">
          {fmt(p.size.snapped, { exact, priced })}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {assured?.price.net_after_subsidy && (
          <Stat
            wide
            testId="summary-net"
            label={t.summary.net}
            value={formatInr(assured.price.net_after_subsidy)}
            sub={fmt(t.summary.netPackage, { package: assured.price.display_name ?? assured.id })}
          />
        )}
        {e.savings && <Stat testId="summary-saving" label={t.summary.saving} value={fmt(t.summary.perMonth, { amount: formatInr(e.savings.monthly) })} />}
        {e.savings && (
          <Stat
            testId="summary-payback"
            label={t.summary.payback}
            value={e.payback_years ? fmt(t.summary.years, { years: e.payback_years }) : '—'}
            sub={e.payback_years ? undefined : t.summary.noPayback}
          />
        )}
      </dl>
      {confidence && (
        <p data-testid="confidence" data-confidence={confidence} className="mt-4 rounded-lg bg-white/10 px-3 py-2 font-utility text-xs leading-relaxed text-white/85">
          <span className="font-semibold text-white">
            {t.confidence.label} {t.confidence[confidence]}.
          </span>{' '}
          {reason && fmt(reason, { rate: e.savings?.rate_inr_per_kwh ?? '' })}
        </p>
      )}
    </div>
  )
}

function OptionCard({ o, t, hidePrices }: { o: SizeOption; t: EstimateCopy; hidePrices?: boolean }) {
  const pkg = hidePrices ? null : firstPackage(o.packages)
  const label = (t.options as Record<string, string>)[o.role] ?? o.role
  return (
    <li
      data-testid="size-option"
      data-role={o.role}
      className={`flex gap-4 rounded-xl border p-4 sm:block ${o.role === 'priced' ? 'border-[#2f5daa] bg-[#2f5daa]/5' : 'border-[#e4e8ee] bg-white'}`}
    >
      <div className="w-24 shrink-0 sm:w-auto">
        <p className="font-utility text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f5daa]">{label}</p>
        <p className="font-display text-2xl font-semibold text-[#0e2a63]">{fmt(t.summary.kw, { kw: String(o.kw) })}</p>
      </div>
      <ul className="min-w-0 space-y-0.5 font-utility text-xs leading-snug text-[#111827]/80 sm:mt-1.5">
        {o.coverage_percent && <li data-testid="option-coverage">{fmt(t.options.coverage, { percent: o.coverage_percent })}</li>}
        {o.generation && <li>{fmt(t.options.generation, { units: formatGrouped(o.generation.monthly_units) })}</li>}
        {pkg?.price.net_after_subsidy && <li>{fmt(t.options.net, { amount: formatInr(pkg.price.net_after_subsidy) })}</li>}
        {o.monthly_saving && <li>{fmt(t.options.saving, { amount: formatInr(o.monthly_saving) })}</li>}
        {o.payback_years && <li>{fmt(t.options.payback, { years: o.payback_years })}</li>}
      </ul>
    </li>
  )
}

function Warnings({ e, t }: { e: SolarEstimate; t: EstimateCopy }) {
  const codes = [...new Set(e.warnings ?? [])]
  if (codes.length === 0) return null
  const w = t.warnings as Record<string, string>
  const text = (code: string) => {
    const d = (e.warning_details?.[code] ?? {}) as Record<string, unknown>
    const s = (v: unknown) => (v == null ? '' : String(v))
    const vars: Record<string, string> = {
      kw: s(d.priced_kw ?? d.exact_kw),
      load: s(d.sanctioned_load_kw),
      priced: s(d.priced_kw),
      max: s(d.max_by_area_kw),
      state: s(d.state),
      rate: s(d.implied_tariff_inr_per_kwh),
      discom: s(d.discom),
    }
    return fmt(w[code] ?? w.other, vars)
  }
  return (
    <div data-testid="estimate-warnings" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="font-utility text-sm font-semibold text-amber-900">{t.warnings.title}</p>
      <ul className="mt-2 space-y-2">
        {codes.map((c) => (
          <li key={c} data-testid={`estimate-warning-${c}`} className="flex items-start gap-2 font-utility text-sm leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            {text(c)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SubsidySection({
  e,
  t,
  hidePrices,
  housesPrompt,
}: {
  e: SolarEstimate
  t: EstimateCopy
  hidePrices?: boolean
  housesPrompt?: ReactNode
}) {
  const p = useMessages('pricing')
  const isoDate = useIsoDate()
  const s = e.subsidy as SubsidyBreakdown
  const centralStatus = e.assumptions?.find((a) => a.name === 'central_cfa')?.status
  const conditions = s.conditions.length ? s.conditions : (e.subsidy_conditions ?? [])
  const condText = p.subsidy.conditions as Record<string, string>
  const notes = t.subsidy.notes as Record<string, string>
  const priced = e.price_status === 'list_price' && !hidePrices
  const ids = priced ? orderedPackageIds(Object.keys(e.packages)) : []
  const announced = isPositiveAmount(s.announced_total)
  const ne = t.subsidy.notEligible as Record<string, string>
  return (
    <Section title={t.subsidy.title} testId="subsidy-breakdown">
      {s.status === 'needs_number_of_houses' && (
        <div data-testid="needs-houses" className="mb-3 rounded-lg border border-[#f7a800]/50 bg-[#fffaf0] px-3 py-2.5">
          <p className="font-utility text-sm text-[#7a5200]">{t.subsidy.needsHouses}</p>
          {housesPrompt}
        </div>
      )}
      {s.status === 'not_eligible' && (
        <p data-testid="not-eligible" className="mb-2 font-utility text-sm text-[#111827]/80">
          {(s.reason && ne[s.reason]) || ne.other}
        </p>
      )}
      <dl className="divide-y divide-[#e4e8ee]">
        {s.central && (
          <div data-testid="subsidy-central" className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="font-utility text-sm font-semibold text-[#0e2a63]">{t.subsidy.central}</dt>
              {centralStatus && <StatusBadge status={centralStatus} />}
            </div>
            {s.central.category === 'special' && <dd className="mt-0.5 font-utility text-xs text-[#111827]/70">{t.subsidy.special}</dd>}
            <dd>
              <dl>
                {s.central.slabs.map((sl) => (
                  <Row
                    key={`${sl.from_kwp}-${sl.to_kwp}`}
                    testId="subsidy-slab"
                    label={fmt(t.subsidy.slab, { from: sl.from_kwp, to: sl.to_kwp, kwp: sl.kwp, rate: formatInr(sl.rate_per_kwp) })}
                    value={formatInr(sl.amount)}
                  />
                ))}
              </dl>
            </dd>
          </div>
        )}
        {s.society && (
          <div data-testid="subsidy-society" className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="font-utility text-sm font-semibold text-[#0e2a63]">{t.subsidy.society}</dt>
              {centralStatus && <StatusBadge status={centralStatus} />}
            </div>
            <dd>
              <dl>
                <Row label={fmt(t.subsidy.societyLine, { kwp: s.society.eligible_kwp, rate: formatInr(s.society.rate_per_kwp) })} value={formatInr(s.society.total)} />
              </dl>
              <p data-testid="society-limited" className="font-utility text-xs text-[#111827]/70">
                {fmt((t.subsidy.societyLimited as Record<string, string>)[s.society.limited_by] ?? '', {
                  perHouse: s.society.kwp_per_house,
                  houses: s.society.number_of_houses,
                  kwp: s.society.installed_kwp,
                  max: s.society.max_kwp,
                })}
              </p>
            </dd>
          </div>
        )}
        {s.state.map((st) => (
          <div key={st.state} data-testid="subsidy-state" data-status={st.status} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="flex flex-wrap items-center gap-2 font-utility text-sm font-semibold text-[#0e2a63]">
                {fmt(t.subsidy.state, { state: st.state })}
                <StatusBadge status={st.status} />
              </dt>
              <dd className="font-utility text-sm font-semibold text-[#0e2a63]">{formatInr(st.amount)}</dd>
            </div>
            {st.valid_until && <dd className="font-utility text-xs text-[#111827]/65">{fmt(t.subsidy.validUntil, { date: isoDate(st.valid_until) })}</dd>}
          </div>
        ))}
        {(s.central || s.society) && (
          <Row testId="subsidy-confirmed-total" label={t.subsidy.confirmedTotal} value={formatInr(s.confirmed_total)} />
        )}
      </dl>

      {ids.length > 0 && (
        <div data-testid="net-cost" className="mt-3 rounded-lg bg-[#f7f9fc] px-3 py-2">
          <p className="font-utility text-xs font-semibold uppercase tracking-[0.06em] text-[#111827]/70">{t.subsidy.net}</p>
          <dl>
            {ids.map((id) =>
              e.packages[id].net_after_subsidy ? (
                <Row key={id} strong label={e.packages[id].display_name ?? id} value={formatInr(e.packages[id].net_after_subsidy)} />
              ) : null
            )}
          </dl>
          {announced && (
            <div data-testid="net-if-announced" className="mt-2 border-t border-[#e4e8ee] pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-utility text-xs text-[#111827]/70">{t.subsidy.netIfAnnounced}</p>
                <StatusBadge status="announced" />
              </div>
              <dl>
                {ids.map((id) => {
                  const v = e.packages[id].net_if_announced_support_received
                  return v ? <Row key={id} label={e.packages[id].display_name ?? id} value={formatInr(v)} /> : null
                })}
              </dl>
            </div>
          )}
        </div>
      )}
      {announced && <p className="mt-2 font-utility text-xs leading-relaxed text-[#111827]/65">{t.subsidy.notDeducted}</p>}

      {conditions.length > 0 && (
        <div className="mt-3">
          <p className="font-utility text-xs font-semibold text-[#111827]/75">{t.subsidy.conditionsLead}</p>
          <ul data-testid="subsidy-conditions" className="mt-1 list-disc space-y-0.5 pl-5 font-utility text-xs leading-relaxed text-[#111827]/75">
            {[...new Set(conditions.map((c) => condText[c] ?? condText.other))].map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      )}
      {s.notes.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-utility text-xs text-[#111827]/65">
          {[...new Set(s.notes.map((n) => notes[n] ?? notes.other))].map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function EnergySection({ e, t }: { e: SolarEstimate; t: EstimateCopy }) {
  const g = e.generation
  const s = e.savings
  const lt = e.long_term
  const freeStatus = e.assumptions?.find((a) => a.name === 'free_units_per_month')?.status
  const la = lt?.assumptions
  return (
    <>
      {g && (
        <Section title={t.generation.title} testId="generation">
          <dl>
            <Row label={t.savings.monthly} value={fmt(t.generation.monthly, { units: formatGrouped(g.monthly_units) })} />
            <Row label={t.savings.yearly} value={fmt(t.generation.yearly, { units: formatGrouped(g.annual_units) })} />
          </dl>
          {g.status && g.status !== 'confirmed' && (
            <p className="mt-1 flex flex-wrap items-center gap-2 font-utility text-xs text-[#111827]/70">
              <StatusBadge status={g.status} />
              {/* The warnings box already says this for the state; the badge alone is enough then. */}
              {!e.warnings?.includes('generation_unconfirmed_for_state') && t.generation.unconfirmed}
            </p>
          )}
        </Section>
      )}
      <Section title={t.savings.title} testId="savings">
        {s ? (
          <>
            <dl>
              <Row testId="saving-monthly" label={t.savings.monthly} value={formatInr(s.monthly)} />
              <Row testId="saving-yearly" label={t.savings.yearly} value={formatInr(s.annual)} />
              <Row testId="payback" label={t.savings.payback} value={e.payback_years ? fmt(t.summary.years, { years: e.payback_years }) : t.summary.noPayback} />
            </dl>
            {s.free_units_per_month && (
              <p data-testid="free-units" className="mt-1 flex flex-wrap items-center gap-2 font-utility text-xs leading-relaxed text-[#111827]/70">
                {fmt(t.savings.freeUnits, { units: formatGrouped(s.free_units_per_month) })}
                {freeStatus && <StatusBadge status={freeStatus} />}
              </p>
            )}
          </>
        ) : (
          <p data-testid="no-savings" className="font-utility text-sm text-[#111827]/75">
            {t.savings.none}
          </p>
        )}
        {lt && (lt.total_savings || lt.total_generation) && (
          <div data-testid="long-term" className="mt-3 rounded-lg bg-[#f7f9fc] px-3 py-2">
            <p className="font-utility text-xs font-semibold uppercase tracking-[0.06em] text-[#111827]/70">{fmt(t.savings.longTerm, { years: lt.years })}</p>
            <dl>
              {lt.total_savings && <Row label={t.savings.title} value={fmt(t.savings.longTermSavings, { amount: formatInr(lt.total_savings) })} />}
              {lt.total_generation && <Row label={t.generation.title} value={fmt(t.savings.longTermGeneration, { units: formatGrouped(lt.total_generation) })} />}
            </dl>
            {lt.total_savings && la?.degradation_first_year_percent && la.degradation_annual_percent && la.tariff_escalation_percent_per_year && (
              <p className="mt-1 font-utility text-xs leading-relaxed text-[#111827]/65">
                {fmt(/^0(\.0+)?$/.test(la.tariff_escalation_percent_per_year) ? t.savings.longTermNoteFlat : t.savings.longTermNote, {
                  first: la.degradation_first_year_percent,
                  annual: la.degradation_annual_percent,
                  escalation: la.tariff_escalation_percent_per_year,
                })}
              </p>
            )}
          </div>
        )}
      </Section>
    </>
  )
}

export default function SolarEstimateResult({
  estimate: e,
  catalogue,
  hidePrices,
  chosenLabel,
  phasePrompt,
  housesPrompt,
}: {
  estimate: SolarEstimate
  catalogue: PackageCatalogue | null
  hidePrices?: boolean
  chosenLabel?: string
  /** Calculator only: asked in place of the custom-quote notice when the phase is all that is missing. */
  phasePrompt?: ReactNode
  /** Calculator only: the flat-count input under the "needs number of houses" notice. */
  housesPrompt?: ReactNode
}) {
  const t = useMessages('pricing').estimate
  const floor = (e.size_options ?? []).some((o) => o.role === 'floor')
  const reasons = e.custom_quote_reasons
  const onlyPhase = reasons.length === 1 && reasons[0] === 'phase_unknown'
  // "Choose your phase" cannot help when something else also rules a list price out.
  const shownReasons = reasons.length > 1 ? reasons.filter((r) => r !== 'phase_unknown') : reasons
  return (
    <div data-testid="solar-estimate" data-version={e.estimate_version ?? undefined} className="space-y-4">
      <Summary e={e} t={t} hidePrices={hidePrices} />

      {floor && (
        <div>
          <p className="font-utility text-sm font-semibold text-[#0e2a63]">{t.options.title}</p>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {(e.size_options ?? []).map((o) => (
              <OptionCard key={`${o.role}-${o.kw}`} o={o} t={t} hidePrices={hidePrices} />
            ))}
          </ul>
        </div>
      )}

      <Warnings e={e} t={t} />

      {e.price_status === 'custom_quote' ? (
        onlyPhase && phasePrompt ? phasePrompt : <CustomQuoteNotice reasons={shownReasons} />
      ) : (
        <PriceListSummary fields={e} catalogue={catalogue} chosenLabel={chosenLabel} hidePrices={hidePrices} showSize={false} showSubsidy={false} />
      )}

      {e.subsidy && <SubsidySection e={e} t={t} hidePrices={hidePrices} housesPrompt={housesPrompt} />}

      <EnergySection e={e} t={t} />

      <HowWeCalculate fallback={e.assumptions ?? []} />

      <p data-testid="estimate-footer" className="font-utility text-xs leading-relaxed text-[#111827]/65">
        {t.footer}
      </p>
    </div>
  )
}

/** The read-only result with the package catalogue fetched alongside — for the survey results. */
export function SolarEstimateWithCatalogue({ estimate }: { estimate: SolarEstimate }) {
  const { catalogue } = usePackageCatalogue()
  return <SolarEstimateResult estimate={estimate} catalogue={catalogue} hidePrices={catalogue?.price_display === 'hidden'} />
}
