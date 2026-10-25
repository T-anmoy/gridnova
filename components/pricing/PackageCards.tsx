'use client'

import { CheckCircle2 } from 'lucide-react'
import { useMessages } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/types'
import { formatInr } from '@/lib/money'
import { localizeLifeSpan, localizeOandM, localizeWarranty } from '@/lib/pricing/terms'
import {
  fractionToPercent,
  orderedPackageIds,
  termText,
  type CataloguePackage,
  type GstRule,
  type MakesGroup,
  type PackageCatalogue,
  type PackagePrice,
  type PriceListFields,
} from '@/lib/pricing/price-list'

// Both packages are drawn by the same component with the same classes and the
// same rows — the only differences on screen are the facts the backend sends
// (makes, technology, price). Nothing here ranks or frames one over the other.

function Group({ label, group }: { label: string; group: MakesGroup | undefined }) {
  const m = useMessages('pricing').packages
  if (!group || group.makes.length === 0) return null
  return (
    <div>
      <dt className="font-utility text-xs uppercase tracking-[0.08em] text-[#111827]/65">{label}</dt>
      <dd className="mt-0.5 font-utility text-sm text-[#111827]/85">
        {group.makes.join(', ')}
        {group.or_equivalent && <span className="text-[#111827]/60"> — {m.orEquivalent}</span>}
      </dd>
    </div>
  )
}

const localized = (text: string | null, translate: (v: string) => string) => (text === null ? null : translate(text))

/** The makes / technology / terms rows of one package. */
export function PackageEquipment({ pkg, terms }: { pkg: CataloguePackage; terms?: PackageCatalogue['terms'] }) {
  const t = useMessages('pricing')
  const m = t.packages
  const tech = pkg.equipment.solar_panel?.technology ?? []
  const extra: [string, string | null][] = [
    [m.warranty, localized(termText(terms?.standard_warranty), (v) => localizeWarranty(v, t.terms))],
    [m.om, localized(termText(terms?.o_and_m), (v) => localizeOandM(v, t.terms))],
    [m.life, localized(termText(terms?.solar_panel_life_span), (v) => localizeLifeSpan(v, t.terms))],
  ]
  return (
    <dl className="space-y-2.5">
      <Group label={m.panels} group={pkg.equipment.solar_panel} />
      {tech.length > 0 && (
        <div>
          <dt className="font-utility text-xs uppercase tracking-[0.08em] text-[#111827]/65">{m.technology}</dt>
          <dd className="mt-0.5 font-utility text-sm text-[#111827]/85">{tech.join(', ')}</dd>
        </div>
      )}
      <Group label={m.inverter} group={pkg.equipment.inverter} />
      <Group label={m.cables} group={pkg.equipment.cables} />
      {extra.map(([label, value]) =>
        value ? (
          <div key={label}>
            <dt className="font-utility text-xs uppercase tracking-[0.08em] text-[#111827]/65">{label}</dt>
            <dd className="mt-0.5 font-utility text-sm text-[#111827]/85">{value}</dd>
          </div>
        ) : null
      )}
    </dl>
  )
}

function PriceRows({ price, showNet, netLabel }: { price: PackagePrice; showNet: boolean; netLabel: string }) {
  const m = useMessages('pricing')
  const row = (label: string, value: string, strong?: boolean) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="font-utility text-sm text-[#111827]/65">{label}</dt>
      <dd data-testid="amount" className={strong ? 'font-display text-xl font-semibold text-[#0e2a63]' : 'font-utility text-sm font-semibold text-[#0e2a63]'}>
        {value}
      </dd>
    </div>
  )
  return (
    <div className="mt-4 border-t border-[#e4e8ee] pt-3">
      <dl>
        {row(m.price.basic, formatInr(price.basic))}
        {row(m.price.gst, formatInr(price.gst))}
        {row(m.price.final, formatInr(price.final), true)}
      </dl>
      {showNet && price.net_after_subsidy && (
        <dl className="mt-2 rounded-lg bg-[#f7f9fc] px-3 py-1.5" data-testid="net-after-subsidy">
          {row(netLabel, formatInr(price.net_after_subsidy))}
        </dl>
      )}
    </div>
  )
}

export function PackageCard({
  id,
  pkg,
  price,
  terms,
  tag,
  showNet,
}: {
  id: string
  pkg?: CataloguePackage
  price?: PackagePrice
  terms?: PackageCatalogue['terms']
  tag?: string
  showNet?: boolean
}) {
  const m = useMessages('pricing')
  const name = price?.display_name ?? pkg?.display_name ?? id.replace(/_/g, ' ')
  return (
    <section data-testid="package-card" data-package={id} className="flex h-full flex-col rounded-2xl border border-[#e4e8ee] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-[#0e2a63]">{name}</h3>
        {tag && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#2f5daa]/10 px-2.5 py-1 font-utility text-xs font-semibold text-[#0e2a63]">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {tag}
          </span>
        )}
      </div>
      <div className="mt-3 flex-1">{pkg && <PackageEquipment pkg={pkg} terms={terms} />}</div>
      {price && <PriceRows price={price} showNet={!!showNet} netLabel={m.subsidy.net} />}
    </section>
  )
}

export function OrEquivalentNote() {
  const m = useMessages('pricing')
  return <p className="font-utility text-xs text-[#111827]/60">{m.packages.orEquivalentNote}</p>
}

export function GstExplanation({ rule }: { rule: GstRule | null | undefined }) {
  const m = useMessages('pricing')
  if (!rule) return null
  const total = fractionToPercent(rule.effective_rate)
  const [a, b] = rule.components
  const parts = a && b ? [fractionToPercent(a.rate), fractionToPercent(a.share_of_basic), fractionToPercent(b.rate), fractionToPercent(b.share_of_basic)] : []
  const ok = total && parts.length === 4 && parts.every(Boolean)
  const text = ok
    ? fmt(m.price.gstExplain, { total, rate1: parts[0]!, share1: parts[1]!, rate2: parts[2]!, share2: parts[3]! })
    : rule.description
  if (!text) return null
  return (
    <p data-testid="gst-explanation" className="font-utility text-sm text-[#111827]/70">
      {text}
    </p>
  )
}

/** Both packages, equal, in a fixed order (or the chosen one first). */
export function PackageGrid({
  catalogue,
  packages,
  chosen,
  chosenLabel,
  showNet,
  hidePrices,
}: {
  catalogue: PackageCatalogue | null
  packages: Record<string, PackagePrice>
  chosen?: string[] | null
  chosenLabel?: string
  showNet?: boolean
  hidePrices?: boolean
}) {
  const ids = orderedPackageIds(
    Object.keys(packages).length > 0 ? Object.keys(packages) : (catalogue?.packages.map((p) => p.package) ?? []),
    chosen
  )
  const onlyChosen = chosen?.length === 1 ? chosen[0] : null
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="package-grid">
      {ids.map((id) => (
        <PackageCard
          key={id}
          id={id}
          pkg={catalogue?.packages.find((p) => p.package === id)}
          price={hidePrices ? undefined : packages[id]}
          terms={catalogue?.terms}
          tag={onlyChosen === id ? chosenLabel : undefined}
          showNet={showNet}
        />
      ))}
    </div>
  )
}

/**
 * Everything the result of a price-list estimate needs, shared by the calculator and the portal.
 * A BE-14 estimate draws its own size and subsidy lines (SolarEstimateResult), so it turns
 * `showSize` / `showSubsidy` off and keeps only the packages, GST and footer from here.
 */
export function PriceListSummary({
  fields,
  catalogue,
  chosenLabel,
  hidePrices,
  showSize = true,
  showSubsidy = true,
}: {
  fields: PriceListFields
  catalogue: PackageCatalogue | null
  chosenLabel?: string
  hidePrices?: boolean
  showSize?: boolean
  showSubsidy?: boolean
}) {
  const m = useMessages('pricing')
  const exact = fields.recommended_kw_exact != null ? String(fields.recommended_kw_exact) : null
  const priced = fields.priced_kw != null ? String(fields.priced_kw) : null
  const conditions = fields.subsidy_conditions ?? []
  const hasSubsidy = showSubsidy && conditions.length > 0
  const version = fields.price_list_version ?? catalogue?.price_list_version
  const destination = fields.destination ?? catalogue?.destination
  return (
    <div className="space-y-4">
      {showSize && (
        <div data-testid="size-lines" className="space-y-1">
          {priced ? (
            <p className="font-display text-base font-semibold text-[#0e2a63]">{fmt(m.size.priced, { kw: priced })}</p>
          ) : null}
          {fields.priced_kw_differs && exact && priced && (
            <p data-testid="snapped-note" className="font-utility text-sm text-[#111827]/75">
              {fmt(m.size.snapped, { exact, priced })}
            </p>
          )}
        </div>
      )}

      {hidePrices && <p data-testid="prices-hidden" className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] px-4 py-3 font-utility text-sm text-[#111827]/75">{m.hidden}</p>}

      <PackageGrid catalogue={catalogue} packages={fields.packages} chosen={fields.chosen_packages} chosenLabel={chosenLabel} showNet={hasSubsidy} hidePrices={hidePrices} />
      <OrEquivalentNote />
      {!hidePrices && <GstExplanation rule={fields.gst_rule ?? catalogue?.gst_rule} />}

      {hasSubsidy && !hidePrices && (
        <div data-testid="subsidy-block" className="rounded-xl border border-[#f7a800]/50 bg-[#fffaf0] px-4 py-3">
          <p className="font-utility text-sm font-semibold text-[#7a5200]">{m.subsidy.title}</p>
          {fields.subsidy_inr != null && Number(fields.subsidy_inr) > 0 && (
            <p className="mt-1 font-utility text-sm text-[#111827]/80">{fmt(m.subsidy.amount, { amount: formatInr(String(fields.subsidy_inr)) })}</p>
          )}
          <p className="mt-1 font-utility text-xs text-[#111827]/65">{m.subsidy.separate}</p>
          <p className="mt-2 font-utility text-xs font-semibold text-[#111827]/70">{m.subsidy.conditionsLead}</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-5 font-utility text-xs text-[#111827]/75">
            {conditions.map((c) => (
              <li key={c}>{(m.subsidy.conditions as Record<string, string>)[c] ?? c}</li>
            ))}
          </ul>
        </div>
      )}

      {fields.note && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-utility text-sm text-amber-800">{fields.note}</p>}

      <p data-testid="price-footer" className="font-utility text-xs text-[#111827]/65">
        {destination && <>{fmt(m.footer.destination, { destination })} </>}
        {m.footer.revise}
        {version && <> {fmt(m.footer.version, { version })}</>}
      </p>
    </div>
  )
}

/** Custom-quote states: a friendly line per reason and never a number. */
export function CustomQuoteNotice({ reasons }: { reasons: string[] }) {
  const m = useMessages('pricing').customQuote
  const texts = (reasons.length ? reasons : ['other']).map((r) => (m.reasons as Record<string, string>)[r] ?? m.reasons.other)
  return (
    <div data-testid="custom-quote" className="rounded-xl border border-[#e4e8ee] bg-[#f7f9fc] p-5">
      <p className="font-display text-lg font-semibold text-[#0e2a63]">{m.title}</p>
      <ul className="mt-3 space-y-2">
        {[...new Set(texts)].map((t) => (
          <li key={t} className="font-utility text-sm leading-relaxed text-[#111827]/80">
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-utility text-sm text-[#111827]/70">{m.body}</p>
    </div>
  )
}
