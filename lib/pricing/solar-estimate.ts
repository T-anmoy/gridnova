import { API_BASE_URL } from '@/lib/config'
import { orderedPackageIds, parsePriceListEstimate, type PackagePrice, type PriceListFields } from '@/lib/pricing/price-list'

// The BE-14 solar estimate engine's figures (docs/api/solar_estimate.md): size,
// generation, subsidy with status, savings, payback, 25 years. Every figure is
// the backend's own decimal string and is only ever displayed — nothing here
// adds, scales or rounds a number. Pre-BE-14 estimates simply lack these
// fields, so every one is optional and a section is drawn only when present.

/** `confirmed` is deducted, `announced` is shown but never deducted, `unconfirmed` is a labelled default. */
export type FigureStatus = 'confirmed' | 'announced' | 'unconfirmed' | (string & {})
export type Confidence = 'high' | 'medium' | 'low'

export interface SizeOption {
  kw: number | string
  role: 'priced' | 'floor' | (string & {})
  coverage_percent: string | null
  generation: { monthly_units: string; annual_units: string } | null
  subsidy_confirmed_total: string | null
  announced_state_support_total: string | null
  packages: Record<string, PackagePrice>
  net_cost: string | null
  monthly_saving: string | null
  annual_saving: string | null
  payback_years: string | null
}

export interface Generation {
  units_per_kwp_per_month: string
  monthly_units: string
  annual_units: string
  status: FigureStatus
  source?: string
}

export interface CentralSubsidy {
  category: 'general' | 'special' | (string & {})
  basis: string
  capacity_kwp: string
  slabs: { from_kwp: string; to_kwp: string; kwp: string; rate_per_kwp: string; amount: string }[]
  total: string
  max_inr: string
}

export interface SocietySubsidy {
  category: string
  rate_per_kwp: string
  number_of_houses: number
  installed_kwp: string
  eligible_kwp: string
  limited_by: 'installed' | 'houses' | 'max_kwp' | (string & {})
  kwp_per_house: string
  max_kwp: string
  total: string
  basis: string
}

export interface StateSupport {
  state: string
  amount: string
  status: FigureStatus
  note?: string | null
  source?: string | null
  as_of?: string | null
  valid_until?: string | null
  rule?: string | null
}

export type SubsidyStatus = 'eligible' | 'needs_number_of_houses' | 'not_eligible' | (string & {})

export interface SubsidyBreakdown {
  status: SubsidyStatus
  reason: string | null
  central: CentralSubsidy | null
  society: SocietySubsidy | null
  state: StateSupport[]
  confirmed_total: string
  announced_total: string
  conditions: string[]
  notes: string[]
}

export interface Savings {
  monthly: string
  annual: string
  method: string
  tariff_source: 'discom_tariff' | 'customer_bill' | 'flat_rate' | (string & {})
  confidence: Confidence
  monthly_bill_before: string | null
  monthly_bill_after: string | null
  rate_inr_per_kwh: string | null
  tariff_table: string | null
  free_units_per_month: string | null
}

export interface LongTerm {
  years: number
  total_generation: string | null
  total_savings: string | null
  assumptions: {
    degradation_first_year_percent?: string
    degradation_annual_percent?: string
    tariff_escalation_percent_per_year?: string
  }
}

export interface Assumption {
  name: string
  value: unknown
  unit?: string | null
  status: FigureStatus
  source?: string | null
  as_of?: string | null
}

export interface SolarEstimateFields {
  estimate_version?: string | null
  sizing_basis?: string | null
  consumption_basis?: string | null
  monthly_units_used?: string | null
  roof_limited?: boolean
  figures_for_kw?: string | null
  size_options?: SizeOption[]
  generation?: Generation | null
  coverage_percent?: string | null
  subsidy?: SubsidyBreakdown | null
  /** Assured's net after confirmed subsidy only — the back-compat number, never computed here. */
  net_cost?: number | string | null
  net_cost_if_announced_support_received?: string | null
  savings?: Savings | null
  payback_years?: string | null
  long_term?: LongTerm | null
  assumptions?: Assumption[]
  confidence?: Confidence | null
  warnings?: string[]
  warning_details?: Record<string, Record<string, unknown>>
}

export type SolarEstimate = PriceListFields & SolarEstimateFields

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const strOrNull = (v: unknown): string | null => (isStr(v) ? v : typeof v === 'number' ? String(v) : null)
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : [])

function packagesOf(v: unknown): Record<string, PackagePrice> {
  if (!isObj(v)) return {}
  const out: Record<string, PackagePrice> = {}
  for (const [id, p] of Object.entries(v)) {
    if (isObj(p) && isStr(p.basic) && isStr(p.gst) && isStr(p.final)) out[id] = p as unknown as PackagePrice
  }
  return out
}

function sizeOptions(v: unknown): SizeOption[] {
  if (!Array.isArray(v)) return []
  return v.filter(isObj).filter((o) => (typeof o.kw === 'number' || isStr(o.kw)) && isStr(o.role)).map((o) => ({
    kw: o.kw as number | string,
    role: o.role as string,
    coverage_percent: strOrNull(o.coverage_percent),
    generation: isObj(o.generation) && isStr(o.generation.monthly_units) && isStr(o.generation.annual_units)
      ? { monthly_units: o.generation.monthly_units, annual_units: o.generation.annual_units }
      : null,
    subsidy_confirmed_total: strOrNull(o.subsidy_confirmed_total),
    announced_state_support_total: strOrNull(o.announced_state_support_total),
    packages: packagesOf(o.packages),
    net_cost: strOrNull(o.net_cost),
    monthly_saving: strOrNull(o.monthly_saving),
    annual_saving: strOrNull(o.annual_saving),
    payback_years: strOrNull(o.payback_years),
  }))
}

function subsidyOf(v: unknown): SubsidyBreakdown | null {
  if (!isObj(v) || !isStr(v.status)) return null
  const central = isObj(v.central) && isStr(v.central.total) && Array.isArray(v.central.slabs)
    ? ({ ...v.central, slabs: v.central.slabs.filter((s) => isObj(s) && isStr(s.amount)) } as unknown as CentralSubsidy)
    : null
  const society = isObj(v.society) && isStr(v.society.total) ? (v.society as unknown as SocietySubsidy) : null
  const state = Array.isArray(v.state)
    ? (v.state.filter((s) => isObj(s) && isStr(s.state) && isStr(s.amount) && isStr(s.status)) as unknown as StateSupport[])
    : []
  return {
    status: v.status,
    reason: strOrNull(v.reason),
    central,
    society,
    state,
    confirmed_total: strOrNull(v.confirmed_total) ?? '0.00',
    announced_total: strOrNull(v.announced_total) ?? '0.00',
    conditions: strList(v.conditions),
    notes: strList(v.notes),
  }
}

/** The BE-14 fields of an estimate, each checked; a malformed part is dropped rather than shown wrong. */
export function solarFieldsOf(d: Record<string, unknown>): SolarEstimateFields {
  const g = d.generation
  const s = d.savings
  const lt = d.long_term
  return {
    estimate_version: strOrNull(d.estimate_version),
    sizing_basis: strOrNull(d.sizing_basis),
    consumption_basis: strOrNull(d.consumption_basis),
    monthly_units_used: strOrNull(d.monthly_units_used),
    roof_limited: d.roof_limited === true,
    figures_for_kw: strOrNull(d.figures_for_kw),
    size_options: sizeOptions(d.size_options),
    generation:
      isObj(g) && isStr(g.monthly_units) && isStr(g.annual_units)
        ? ({ ...g, units_per_kwp_per_month: strOrNull(g.units_per_kwp_per_month) ?? '', status: strOrNull(g.status) ?? '' } as Generation)
        : null,
    coverage_percent: strOrNull(d.coverage_percent),
    subsidy: subsidyOf(d.subsidy),
    net_cost: typeof d.net_cost === 'number' || isStr(d.net_cost) ? d.net_cost : null,
    net_cost_if_announced_support_received: strOrNull(d.net_cost_if_announced_support_received),
    savings:
      isObj(s) && isStr(s.monthly) && isStr(s.annual)
        ? ({ ...s, rate_inr_per_kwh: strOrNull(s.rate_inr_per_kwh), free_units_per_month: strOrNull(s.free_units_per_month) } as Savings)
        : null,
    payback_years: strOrNull(d.payback_years),
    long_term:
      isObj(lt) && typeof lt.years === 'number'
        ? {
            years: lt.years,
            total_generation: strOrNull(lt.total_generation),
            total_savings: strOrNull(lt.total_savings),
            assumptions: isObj(lt.assumptions) ? (lt.assumptions as LongTerm['assumptions']) : {},
          }
        : null,
    assumptions: Array.isArray(d.assumptions)
      ? (d.assumptions.filter((a) => isObj(a) && isStr(a.name) && isStr(a.status)) as unknown as Assumption[])
      : [],
    confidence: d.confidence === 'high' || d.confidence === 'medium' || d.confidence === 'low' ? d.confidence : null,
    warnings: strList(d.warnings),
    warning_details: isObj(d.warning_details) ? (d.warning_details as Record<string, Record<string, unknown>>) : {},
  }
}

/** POST /pricing/instant-estimate's response, checked; null means "unexpected shape". */
export function parseSolarEstimate(data: unknown): (SolarEstimate & Record<string, unknown>) | null {
  const base = parsePriceListEstimate(data)
  if (!base) return null
  return { ...base, ...solarFieldsOf(base) }
}

/**
 * A survey result's `estimate` (site_survey.md §4, BE-14 §5) in the shared shape.
 * It has no `figures_for_kw`; its `size_kw` is the size every figure is for.
 * Null when it is not a BE-14 estimate or is not priced at all (`not_enough_to_size`).
 */
export function fromSurveyEstimate(est: Record<string, unknown>): (SolarEstimate & Record<string, unknown>) | null {
  if (!isStr(est.estimate_version)) return null
  const size = est.priced_kw ?? est.size_kw
  return parseSolarEstimate({ ...est, priced_kw: size, figures_for_kw: est.figures_for_kw ?? strOrNull(size) })
}

/** A BE-14 estimate carries `estimate_version`; anything older is drawn the pre-BE-14 way. */
export function isSolarEstimate(fields: SolarEstimateFields): boolean {
  return !!fields.estimate_version
}

/** The size the figures are for: the priced size, else the exact one, as the backend sent it. */
export function figuresKw(e: SolarEstimate): string | null {
  return e.figures_for_kw ?? (e.priced_kw != null ? String(e.priced_kw) : e.recommended_kw_exact != null ? String(e.recommended_kw_exact) : null)
}

/**
 * The calculator's DISCOM list shows names ("CESC Limited (Kolkata & parts of
 * Howrah)"); the engine looks tariffs up by code ("CESC"). The code is the
 * leading capitals only when the rest is a "Limited" and/or a bracketed
 * description, so "CESC Mysuru" (Karnataka) is sent whole and can never pick
 * up Kolkata's CESC table.
 */
export function discomCode(label: string): string {
  const m = /^([A-Z][A-Za-z&]*[A-Z])(?:\s+Limited)?(?:\s+\(.*\))?$/.exec(label.trim())
  return m ? m[1] : label.trim()
}

/** What the lead keeps of the estimate the visitor saw — every value copied, none computed. */
export interface EstimateSnapshot {
  estimateVersion?: string
  sizeKw?: string
  priceStatus?: string
  netCostInr?: string
  netCostIfAnnouncedInr?: string
  subsidyConfirmedInr?: string
  subsidyAnnouncedInr?: string
  subsidyStatus?: string
  monthlySavingInr?: string
  paybackYears?: string
  confidence?: string
}

export function estimateSnapshot(e: SolarEstimate): EstimateSnapshot {
  // The first package in the fixed order (Nova Assured) — the one `net_cost` is for.
  const assured = e.packages[orderedPackageIds(Object.keys(e.packages))[0]]
  const opt = <T>(v: T | null | undefined) => (v == null ? undefined : v)
  return {
    estimateVersion: opt(e.estimate_version),
    sizeKw: opt(figuresKw(e)),
    priceStatus: e.price_status,
    netCostInr: opt(assured?.net_after_subsidy),
    netCostIfAnnouncedInr: opt(e.net_cost_if_announced_support_received),
    subsidyConfirmedInr: opt(e.subsidy?.confirmed_total),
    subsidyAnnouncedInr: opt(e.subsidy?.announced_total),
    subsidyStatus: opt(e.subsidy?.status),
    monthlySavingInr: opt(e.savings?.monthly),
    paybackYears: opt(e.payback_years),
    confidence: opt(e.confidence),
  }
}

// ── GET /api/v1/pricing/estimate-assumptions (§4) ────────────────────────

export interface AssumptionValue {
  name?: string
  state?: string
  value: unknown
  unit?: string | null
  status: FigureStatus
  source?: string | null
  as_of?: string | null
}

export interface EstimateAssumptions {
  estimate_version: string
  generation?: {
    units_per_kwp_per_month?: AssumptionValue[]
    system_losses?: string
    shading?: string
    degradation?: AssumptionValue[]
  }
  roof_area?: AssumptionValue[]
  sizing?: { target_offset?: AssumptionValue; formula?: string; sanctioned_load?: string }
  savings?: {
    method?: string
    escalation?: AssumptionValue
    long_term_years?: AssumptionValue
    export_credit?: (AssumptionValue & { rule?: string })[]
    o_and_m?: AssumptionValue
    payback?: string
  }
  tariffs?: {
    flat_rate?: AssumptionValue
    implied_rate_sanity?: { min: string; max: string; unit?: string; status: FigureStatus; source?: string; as_of?: string }
    discoms?: { state: string; discom: string; category: string; status: FigureStatus; source?: string; as_of?: string; available: boolean }[]
    free_units?: (AssumptionValue & { discoms?: string[] })[]
  }
  confidence_rules?: Partial<Record<Confidence, string>>
  subsidies?: {
    central?: {
      scheme?: string
      status: FigureStatus
      source?: string
      as_of?: string
      residential?: Record<string, { slabs: { up_to_kwp: string; rate_per_kwp: string }[]; max_inr: string }>
      housing_society?: { rate_per_kwp: Record<string, string>; kwp_per_house: string; max_kwp: string }
      special_category_states?: string[]
      conditions?: string[]
    }
    state_top_ups?: { state: string; note?: string; status: FigureStatus; source?: string; as_of?: string; valid_until?: string | null }[]
    deduction_rule?: string
  }
}

/** GET /api/v1/pricing/estimate-assumptions — public, the engine's own config. */
export async function fetchEstimateAssumptions(signal?: AbortSignal): Promise<EstimateAssumptions> {
  const res = await fetch(`${API_BASE_URL}/api/v1/pricing/estimate-assumptions`, { signal })
  if (!res.ok) throw new Error(`estimate-assumptions ${res.status}`)
  const data = (await res.json()) as EstimateAssumptions
  if (!isObj(data) || !isStr(data.estimate_version)) throw new Error('unexpected estimate-assumptions shape')
  return data
}
