// Test data only — the makes, technologies and amounts below are made up for
// the tests and are NOT Grid Nova's real price list.
import type { PackageCatalogue, PriceRow } from '@/lib/pricing/price-list'

const GST_RULE = {
  effective_rate: '0.089',
  components: [
    { share_of_basic: '0.7', rate: '0.05' },
    { share_of_basic: '0.3', rate: '0.18' },
  ],
  description: 'GST is 8.9% effective.',
}

function rows(): PriceRow[] {
  const out: PriceRow[] = []
  for (const pkg of ['NOVA_ASSURED', 'NOVA_SIGNATURE']) {
    for (const [phase, from] of [['SINGLE', 1], ['THREE', 3]] as const) {
      for (let kw = from; kw <= 10; kw++) {
        out.push({ package: pkg, phase, kw, basic: `${kw}00000.00`, gst: `${kw}8900.00`, final: `${kw}08900.00` })
      }
    }
  }
  return out
}

export const CATALOGUE: PackageCatalogue = {
  price_list_version: 'TEST-2026-01',
  destination: 'West Bengal',
  currency: 'INR',
  packages: [
    {
      package: 'NOVA_ASSURED',
      display_name: 'Nova Assured',
      equipment_tier: 'standard',
      equipment: {
        solar_panel: { makes: ['Test Panel Co A', 'Test Panel Co B'], or_equivalent: true, technology: ['Test technology one'] },
        inverter: { makes: ['Test Inverter Co A'], or_equivalent: true },
      },
    },
    {
      package: 'NOVA_SIGNATURE',
      display_name: 'Nova Signature',
      equipment_tier: 'premium',
      equipment: {
        solar_panel: { makes: ['Test Panel Co C'], or_equivalent: true, technology: ['Test technology two', 'Test technology three'] },
        inverter: { makes: ['Test Inverter Co B'], or_equivalent: true },
        cables: { makes: ['Test Cable Co'], or_equivalent: true },
      },
    },
  ],
  phase_ranges: { SINGLE: { min_kw: 1, max_kw: 10 }, THREE: { min_kw: 3, max_kw: 10 } },
  gst_rule: GST_RULE,
  terms: {
    payment_schedule: [
      { number: 1, percent: 20, label: 'Label One From API' },
      { number: 2, percent: 60, label: 'Label Two From API' },
      { number: 3, percent: 20, label: 'Label Three From API' },
    ],
    standard_warranty: 'Test warranty text',
    solar_panel_life_span: 'Test life span text',
    o_and_m: 'Test O&M text',
    price_change_clause: 'Test clause',
  },
  price_display: 'exact',
  prices: rows(),
}

export const LIST_ESTIMATE = {
  recommended_size_kw: 3.4,
  sizing_detail: { consumption_based_kw: 3.4, area_based_kw: null, phase_capped: false },
  base_cost: 400000,
  adders: {},
  component_breakdown: {},
  subtotal_before_tax: 400000,
  gst_amount: 35600,
  subsidy_inr: 78000,
  net_cost: 357600,
  is_indicative_range: false,
  net_cost_range_min: null,
  net_cost_range_max: null,
  note: null,
  price_status: 'list_price',
  custom_quote_reasons: [],
  recommended_kw_exact: '3.40',
  priced_kw: 4,
  priced_kw_differs: true,
  phase: 'SINGLE',
  packages: {
    NOVA_ASSURED: { basic: '412345.67', gst: '36698.76', final: '449044.43', net_after_subsidy: '371044.43', display_name: 'Nova Assured' },
    NOVA_SIGNATURE: { basic: '461826.15', gst: '41102.32', final: '502928.47', net_after_subsidy: '424928.47', display_name: 'Nova Signature' },
  },
  gst_rule: GST_RULE,
  price_list_version: 'TEST-2026-01',
  destination: 'West Bengal',
  subsidy_conditions: ['dcr_modules_required', 'scheme_eligibility'],
}

export const CUSTOM_QUOTE = (reasons: string[]) => ({
  ...LIST_ESTIMATE,
  base_cost: null,
  subtotal_before_tax: null,
  gst_amount: null,
  net_cost: null,
  price_status: 'custom_quote',
  custom_quote_reasons: reasons,
  priced_kw: null,
  priced_kw_differs: false,
  phase: null,
  packages: {},
  subsidy_conditions: [],
})
