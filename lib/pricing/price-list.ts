import { API_BASE_URL } from '@/lib/config'

// Grid Nova's price list (backend PM-A). Every amount is an exact decimal
// string and is only ever displayed — never added, scaled or rounded here.

export const PACKAGE_ORDER = ['NOVA_ASSURED', 'NOVA_SIGNATURE'] as const

export type PriceStatus = 'list_price' | 'custom_quote'

export interface PackagePrice {
  basic: string
  gst: string
  final: string
  net_after_subsidy?: string | null
  /** BE-14: net_after_subsidy minus announced state support — information only, never the net cost. */
  net_if_announced_support_received?: string | null
  display_name?: string
}

export interface GstRule {
  effective_rate: string
  components: { share_of_basic: string; rate: string }[]
  description?: string
}

// The shared part of POST /pricing/instant-estimate's response and of a stored
// associate estimate's `result` (PM-A §1, §4).
export interface PriceListFields {
  price_status: PriceStatus
  custom_quote_reasons: string[]
  recommended_kw_exact?: number | string | null
  priced_kw?: number | string | null
  priced_kw_differs?: boolean
  phase?: 'SINGLE' | 'THREE' | null
  packages: Record<string, PackagePrice>
  gst_rule?: GstRule | null
  price_list_version?: string | null
  destination?: string | null
  subsidy_conditions?: string[]
  subsidy_inr?: number | string | null
  note?: string | null
  chosen_packages?: string[] | null
}

export interface MakesGroup {
  makes: string[]
  or_equivalent: boolean
  technology?: string[]
}

export interface CataloguePackage {
  package: string
  display_name: string
  equipment_tier: string
  equipment: { solar_panel?: MakesGroup; inverter?: MakesGroup; cables?: MakesGroup }
}

export interface PriceRow {
  package: string
  phase: string
  kw: number | string
  basic: string
  gst: string
  final: string
}

export interface PackageCatalogue {
  price_list_version: string
  destination: string
  currency?: string
  packages: CataloguePackage[]
  phase_ranges: Record<string, { min_kw: number; max_kw: number }>
  gst_rule: GstRule
  terms: {
    payment_schedule?: { number: number; percent: number | string; label: string }[]
    standard_warranty?: unknown
    solar_panel_life_span?: unknown
    o_and_m?: unknown
    price_change_clause?: unknown
  }
  price_display: 'exact' | 'hidden'
  prices?: PriceRow[]
}

/** The two packages first, in a fixed order, then anything new in the API's order. */
export function orderedPackageIds(ids: string[], chosenFirst?: string[] | null): string[] {
  const rank = (id: string) => {
    const i = PACKAGE_ORDER.indexOf(id as (typeof PACKAGE_ORDER)[number])
    return i === -1 ? PACKAGE_ORDER.length : i
  }
  const sorted = [...ids].sort((a, b) => rank(a) - rank(b))
  const chosen = chosenFirst?.length === 1 ? chosenFirst[0] : null
  return chosen && sorted.includes(chosen) ? [chosen, ...sorted.filter((i) => i !== chosen)] : sorted
}

/**
 * "0.089" → "8.9", "0.7" → "70": a decimal-point shift on the string, so no
 * float is ever involved. Null when the text is not a plain decimal.
 */
export function fractionToPercent(fraction: string): string | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(fraction.trim())
  if (!m) return null
  const frac = `${m[2] ?? ''}00`
  const whole = `${m[1]}${frac.slice(0, 2)}`.replace(/^0+(?=\d)/, '')
  const rest = frac.slice(2).replace(/0+$/, '')
  return rest ? `${whole}.${rest}` : whole
}

const isStr = (v: unknown): v is string => typeof v === 'string'

/** Validates the parts of an estimate the UI depends on; null means "unexpected shape". */
export function parsePriceListEstimate(data: unknown): (PriceListFields & Record<string, unknown>) | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.price_status !== 'list_price' && d.price_status !== 'custom_quote') return null
  const packages = (d.packages && typeof d.packages === 'object' ? d.packages : {}) as Record<string, Record<string, unknown>>
  if (d.price_status === 'list_price') {
    const entries = Object.values(packages)
    if (entries.length === 0 || !entries.every((p) => isStr(p.basic) && isStr(p.gst) && isStr(p.final))) return null
  }
  return {
    ...d,
    price_status: d.price_status,
    custom_quote_reasons: Array.isArray(d.custom_quote_reasons) ? d.custom_quote_reasons.filter(isStr) : [],
    packages: d.price_status === 'list_price' ? (packages as unknown as Record<string, PackagePrice>) : {},
    subsidy_conditions: Array.isArray(d.subsidy_conditions) ? d.subsidy_conditions.filter(isStr) : [],
  } as PriceListFields & Record<string, unknown>
}

const BASE = () => API_BASE_URL

/** GET /api/v1/pricing/packages — public. */
export async function fetchPackageCatalogue(signal?: AbortSignal): Promise<PackageCatalogue> {
  const res = await fetch(`${BASE()}/api/v1/pricing/packages`, { signal })
  if (!res.ok) throw new Error(`packages ${res.status}`)
  const data = (await res.json()) as PackageCatalogue
  if (!data || !Array.isArray(data.packages)) throw new Error('unexpected packages shape')
  return data
}

/** A term the backend sends as text; anything else is left out rather than guessed at. */
export function termText(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number') return String(v)
  return null
}
