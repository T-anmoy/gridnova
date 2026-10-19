'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatInr } from '@/lib/money'
import { formatCurrency } from '@/lib/dashboard/utils'
import type { ProposalContent } from '@/lib/dashboard/types'

// Staff-facing wording for the reasons a proposal has no list price.
const REASON: Record<string, string> = {
  outside_west_bengal: 'The site is outside West Bengal.',
  segment_not_in_price_list: 'The customer segment is not in the price list.',
  battery_or_off_grid: 'Battery or off-grid system.',
  phase_unknown: 'Connection phase is not known.',
  size_above_max: 'Size is above the price list maximum.',
  three_phase_below_min: 'Three-phase size is below the price list minimum.',
  size_below_min: 'Size is below the price list minimum.',
  package_not_chosen: 'No package has been chosen.',
  size_unknown: 'The requested size is not known.',
  non_integer_size: 'The requested size is not a whole kW.',
}

/** The list-price snapshot on a proposal, with the adjustment and variance when the price was changed. */
export default function ProposalPricing({ content, totalValue }: { content: ProposalContent | null; totalValue: number | null }) {
  const p = content?.pricing
  if (!p) return null
  const version = p.price_list_version ?? content?.price_list?.version
  const sha = p.source_sha256 ?? content?.price_list?.source_sha256
  return (
    <Card data-testid="proposal-pricing">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>Price list pricing</span>
          {version && <Badge variant="outline" data-testid="proposal-price-version">Price list {version}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {p.price_status === 'custom_quote' ? (
          <div data-testid="proposal-custom-quote">
            <p className="font-medium text-amber-800">Custom quote — no list price.</p>
            <ul className="mt-1 list-disc pl-5 text-gray-700">
              {(p.custom_quote_reasons ?? []).map((r) => (
                <li key={r}>{REASON[r] ?? r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><dt className="text-xs text-gray-500">Package</dt><dd>{p.package_name ?? p.package}</dd></div>
              <div><dt className="text-xs text-gray-500">Size</dt><dd>{p.kw != null ? `${p.kw} kW` : '—'}{p.phase ? ` · ${p.phase}` : ''}</dd></div>
              <div><dt className="text-xs text-gray-500">Basic</dt><dd data-testid="list-basic">{formatInr(p.basic)}</dd></div>
              <div><dt className="text-xs text-gray-500">GST</dt><dd data-testid="list-gst">{formatInr(p.gst)}</dd></div>
              <div><dt className="text-xs text-gray-500">List price (final)</dt><dd className="font-semibold" data-testid="list-final">{formatInr(p.adjusted ? (p.list_price_final ?? p.final) : p.final)}</dd></div>
            </dl>
            {p.gst_rule?.description && <p className="text-xs text-gray-500">{p.gst_rule.description}</p>}
            {p.adjusted && (
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:grid-cols-3" data-testid="proposal-adjusted">
                <div><dt className="text-xs text-amber-700">Adjusted price</dt><dd className="font-semibold" data-testid="adjusted-price">{formatCurrency(totalValue)}</dd></div>
                <div><dt className="text-xs text-amber-700">Variance from list</dt><dd className="font-semibold" data-testid="variance">{p.variance != null ? formatInr(p.variance) : '—'}</dd></div>
              </dl>
            )}
          </>
        )}
        {(p.destination || sha) && (
          <p className="text-xs text-gray-500">
            {p.destination && <>Destination: {p.destination}. </>}
            {sha && <span title={sha}>Source fingerprint {sha.slice(0, 12)}…</span>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
