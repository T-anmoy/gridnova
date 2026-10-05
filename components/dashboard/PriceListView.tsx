'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatInr } from '@/lib/money'
import { termText, type PackageCatalogue, type MakesGroup } from '@/lib/pricing/price-list'

// Read-only: shows the price list exactly as GET /pricing/packages returns it.
// Nothing here is calculated, sorted by value or editable.

const GROUPS: [keyof PackageCatalogue['packages'][number]['equipment'], string][] = [
  ['solar_panel', 'Solar panels'],
  ['inverter', 'Inverter'],
  ['cables', 'Cables'],
]

function makesLine(g: MakesGroup | undefined): string | null {
  if (!g || g.makes.length === 0) return null
  return `${g.makes.join(', ')}${g.or_equivalent ? ' — or equivalent' : ''}`
}

export default function PriceListView({ catalogue }: { catalogue: PackageCatalogue }) {
  const names = new Map(catalogue.packages.map((p) => [p.package, p.display_name]))
  const rows = catalogue.prices ?? []
  const terms = catalogue.terms
  const termRows: [string, string | null][] = [
    ['Standard warranty', termText(terms.standard_warranty)],
    ['Solar panel life span', termText(terms.solar_panel_life_span)],
    ['Operation & maintenance', termText(terms.o_and_m)],
    ['Price changes', termText(terms.price_change_clause)],
  ]
  return (
    <div className="space-y-6" data-testid="price-list">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <Badge variant="outline" data-testid="price-list-version">Version {catalogue.price_list_version}</Badge>
        <span>Destination: {catalogue.destination}</span>
        {catalogue.currency && <span>· Currency: {catalogue.currency}</span>}
        <span>· Price display: {catalogue.price_display}</span>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Rules</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>{catalogue.gst_rule.description ?? `GST effective rate ${catalogue.gst_rule.effective_rate}`}</p>
          <ul className="list-disc pl-5">
            {catalogue.gst_rule.components.map((c, i) => (
              <li key={i}>share of basic {c.share_of_basic} at rate {c.rate}</li>
            ))}
          </ul>
          <p className="font-medium">Phase ranges</p>
          <ul className="list-disc pl-5" data-testid="phase-ranges">
            {Object.entries(catalogue.phase_ranges).map(([phase, r]) => (
              <li key={phase}>{phase}: {r.min_kw}–{r.max_kw} kW</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Makes per package</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {catalogue.packages.map((p) => (
            <div key={p.package} data-testid="price-list-package" className="space-y-1 text-sm">
              <p className="font-semibold text-[#091c3c]">{p.display_name} <span className="font-normal text-gray-500">({p.equipment_tier})</span></p>
              {GROUPS.map(([key, label]) => {
                const line = makesLine(p.equipment[key])
                return line ? <p key={key}><span className="text-gray-500">{label}:</span> {line}</p> : null
              })}
              {p.equipment.solar_panel?.technology?.length ? <p><span className="text-gray-500">Panel technology:</span> {p.equipment.solar_panel.technology.join(', ')}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Commercial terms</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          {termRows.map(([label, value]) => value ? <p key={label}><span className="text-gray-500">{label}:</span> {value}</p> : null)}
          {terms.payment_schedule && (
            <>
              <p className="font-medium">Payment schedule</p>
              <ul className="list-disc pl-5" data-testid="schedule-terms">
                {terms.payment_schedule.map((s) => (
                  <li key={s.number}>{s.label} — {String(s.percent)}%</li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prices ({rows.length} rows)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {catalogue.price_display === 'hidden' || rows.length === 0 ? (
            <p className="text-sm text-gray-500" data-testid="prices-hidden">The price table is hidden by policy, so no rows were returned.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Package</th>
                  <th className="py-2 pr-4">Phase</th>
                  <th className="py-2 pr-4">kW</th>
                  <th className="py-2 pr-4 text-right">Basic</th>
                  <th className="py-2 pr-4 text-right">GST</th>
                  <th className="py-2 text-right">Final</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.package}-${r.phase}-${r.kw}`} data-testid="price-row" className="border-b border-gray-100">
                    <td className="py-1.5 pr-4">{names.get(r.package) ?? r.package}</td>
                    <td className="py-1.5 pr-4">{r.phase}</td>
                    <td className="py-1.5 pr-4">{String(r.kw)}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{formatInr(r.basic)}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{formatInr(r.gst)}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{formatInr(r.final)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
