// Real responses of the BE-14 solar estimate engine (grid-nova-ai-backend 3d8ae89,
// estimate_version 1.1+ebb9f500bf76) for the worked examples in
// docs/api/solar_estimate.md §3 and two of FE-14's customer runs. Nothing here is
// hand-edited: regenerate by posting the input next to each one to
// POST /api/v1/pricing/instant-estimate on a local backend (and
// GET /api/v1/pricing/estimate-assumptions for the assumptions).
import A from './solar-estimate/A.json'
import B from './solar-estimate/B.json'
import C from './solar-estimate/C.json'
import C_NO_HOUSES from './solar-estimate/C-no-houses.json'
import ASSAM from './solar-estimate/assam-300-units.json'
import CESC_NO_PHASE from './solar-estimate/cesc-bill-no-phase.json'
import ASSUMPTIONS from './solar-estimate/assumptions.json'

/** §3 A — West Bengal, 360 units, single phase: 3 kW priced, 2 kW floor, flat ₹9, WB announced ₹15,000. */
export const EXAMPLE_A = A
export const EXAMPLE_A_INPUT = { segment: 'residential', state: 'West Bengal', sizing_method: 'by_units', monthly_units_kwh: 360, connection_phase: 'single_phase' }

/** §3 B — Bihar, 410 units + ₹3,700, SBPDCL, sanctioned 3 kW: 4 kW, above sanctioned load, own ₹/unit, 125 free units. */
export const EXAMPLE_B = B
export const EXAMPLE_B_INPUT = {
  segment: 'residential', state: 'Bihar', sizing_method: 'by_units', monthly_units_kwh: 410, monthly_bill_inr: 3700,
  discom: 'SBPDCL', sanctioned_load_kw: 3, connection_phase: 'single_phase',
}

/** §3 C — housing society, 100 kWp (10,000 sq ft), 20 houses: society CFA limited by houses; custom quote. */
export const EXAMPLE_C = C
export const EXAMPLE_C_INPUT = {
  segment: 'residential', state: 'West Bengal', sizing_method: 'by_roof_area', usable_roof_area_sqft: 10000,
  is_housing_society: true, number_of_houses: 20, connection_phase: 'three_phase',
}

/** §3 C without `number_of_houses`: `needs_number_of_houses`, nothing deducted. */
export const EXAMPLE_C_NO_HOUSES = C_NO_HOUSES

/** FE-14 customer 4 — Assam, 300 units: special-category CFA, outside West Bengal (custom quote), generation unconfirmed. */
export const ASSAM_300_UNITS = ASSAM

/** FE-14 customer 2 — West Bengal, CESC, ₹4,000 bill, no phase: `phase_unknown` only. */
export const CESC_BILL_NO_PHASE = CESC_NO_PHASE

/** GET /api/v1/pricing/estimate-assumptions. */
export const ESTIMATE_ASSUMPTIONS = ASSUMPTIONS
