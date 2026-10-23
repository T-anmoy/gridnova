// Shared fixtures built from the backend contract, not from guesses:
// - survey shapes: grid-nova-ai-backend docs/api/site_survey.md §2–§6 (JSON examples);
// - enums (customer timelines, roof materials…): docs/api/openapi.json;
// - the onboarding object: the fields the serializer returns (site_location per phase3c §3).
// Every wizard / survey test should build its data from here.
import type { Onboarding, OnboardingOptions, SubmitIncompleteDetail } from '@/lib/associate/onboarding-types'
import type { SurveyOptions, SurveyResults, SurveyStatus } from '@/lib/associate/survey-types'

const SECTIONS_BASE = [
  { key: 'connection', fields: ['discom', 'consumer_number', 'connection_phase', 'sanctioned_load_kw'] },
  { key: 'bills', fields: ['consumption_history'] },
  { key: 'roof', fields: ['roof_accessible', 'roof_material', 'roof_orientation', 'roof_ownership_confirmed', 'floors', 'shading_condition', 'roof_obstacles'] },
  { key: 'roof_area', fields: ['roof_area_sqft', 'shadow_free_area_sqft'] },
  { key: 'layout', fields: ['inverter_location', 'indoor_wall_available', 'distance_panel_to_inverter_m', 'distance_inverter_to_lt_panel_m', 'distance_method', 'water_available'] },
]

/** §2 — `GET /options` → `survey`. */
export const SURVEY_OPTIONS: SurveyOptions = {
  variants: {
    individual_house: SECTIONS_BASE,
    housing_society: SECTIONS_BASE.map((s) => (s.key === 'connection' ? { ...s, fields: [...s.fields, 'society_flat_count', 'society_noc_status'] } : s)),
    commercial_roof: SECTIONS_BASE.map((s) => (s.key === 'connection' ? { ...s, fields: [...s.fields, 'contract_demand_kva'] } : s)),
  },
  conditional: [
    { section: 'roof', when: { roof_material: 'other' }, require: ['roof_material_other'] },
    { section: 'roof', when: { roof_ownership_confirmed: false }, require: ['tenant_noc_available'] },
  ],
  discom_options: ['WBSEDCL', 'CESC', 'NBPDCL', 'SBPDCL', 'Other'],
  roof_materials: ['concrete_flat', 'tin_shed', 'asbestos', 'other'],
  roof_orientations: ['south', 'east', 'west', 'north', 'mixed', 'unknown'],
  roof_obstacles: ['water_tank', 'stair_room', 'trees', 'nearby_building', 'overhead_line', 'antenna_dish', 'other'],
  inverter_locations: ['terrace', 'indoor_wall', 'outdoor_wall', 'other'],
  distance_methods: ['tape', 'laser', 'estimated'],
  society_noc_statuses: ['obtained', 'in_progress', 'not_required', 'not_available'],
  max_roof_sections: 6,
  requested_consumption_months: 6,
  min_consumption_months: 3,
  max_consumption_months: 12,
  distance_max_m: 300,
  signature_max_kb: 500,
  required_to_submit: true,
  resign_after_edit: true,
}

export const ONBOARDING_OPTIONS: OnboardingOptions = {
  notice: { version: 'v1', text: 'Notice text' },
  equipment_packages: [{ key: 'dcr', label: 'DCR package', equipment_tier: 'standard' }],
  documents: [{ key: 'electricity_bill', label: 'Electricity bill', required_when: null }],
  photo_slots: [
    { key: 'panel_installation_area', label: 'Panel installation area' },
    { key: 'front', label: 'Front of premises' },
  ],
  // openapi.json CustomerTimeline.
  customer_timelines: ['within_1_month', 'within_3_months', 'within_6_months', 'later', 'unsure'],
  site_location: {
    accuracy_good_m: 20,
    accuracy_warn_m: 50,
    accuracy_reject_m: 200,
    sample_seconds: 10,
    required_to_submit: true,
    sources: ['device_gps', 'photo_gps', 'google_maps_link', 'pasted_coordinates'],
    recommended_source: 'photo_gps',
  },
  survey: SURVEY_OPTIONS,
}

/** §3 — the contract's example (nothing filled in yet). */
export const SURVEY_STATUS_EMPTY: SurveyStatus = {
  onboarding_id: 12,
  variant: 'individual_house',
  sections: [
    { key: 'connection', complete: false, missing: ['discom', 'connection_phase'] },
    { key: 'bills', complete: false, missing: ['consumption_history'], months_recorded: 0, months_required: 3, months_requested: 6 },
    { key: 'roof', complete: false, missing: ['roof_accessible'] },
    { key: 'roof_area', complete: false, missing: ['roof_area_sqft', 'shadow_free_area_sqft'] },
    { key: 'layout', complete: false, missing: ['inverter_location'] },
  ],
  complete: false,
  signatures: { customer: { signed: false, signed_at: null }, associate: { signed: false, signed_at: null } },
  declaration: { name: null, declared_at: null },
  required_to_submit: true,
  grandfathered: false,
  review: { outcome: null, notes: null, conditions: [], revisit_items: [], reviewed_at: null, revised_after_review: false },
  report: { generated_at: null },
}

export const SURVEY_STATUS_SIGNED: SurveyStatus = {
  ...SURVEY_STATUS_EMPTY,
  sections: SURVEY_STATUS_EMPTY.sections.map((s) => ({ ...s, complete: true, missing: [] })),
  complete: true,
  signatures: {
    customer: { signed: true, signed_at: '2026-10-12T05:01:02+00:00' },
    associate: { signed: true, signed_at: '2026-10-12T05:02:00+00:00' },
  },
  declaration: { name: 'Asha Roy', declared_at: '2026-10-12T05:01:02+00:00' },
}

/** §4 — the contract's example, with the elided package money filled with decimal strings. */
export const SURVEY_RESULTS: SurveyResults = {
  onboarding_id: 12,
  variant: 'individual_house',
  max_by_area_kw: 7.18,
  max_by_load_kw: 5.0,
  recommended_by_usage_kw: 3.0,
  suggested_kw: 3,
  limiting_factor: 'usage',
  requested_kw: 3.0,
  bills: { months_recorded: 3, average_monthly_units_kwh: 400.0, average_monthly_bill_inr: '3200.00', implied_tariff_inr_per_kwh: '8.00' },
  assumptions: { area_sqft_per_kw: 90, load_cap_ratio: 1.0, target_offset_percent: 90.0 },
  warnings: [],
  estimate: {
    indicative: true,
    size_kw: 3,
    price_status: 'list_price',
    custom_quote_reasons: [],
    priced_kw: 3,
    phase: 'SINGLE',
    packages: {
      NOVA_ASSURED: { basic: '180000.00', gst: '16200.00', final: '196200.00', display_name: 'Nova Assured', net_after_subsidy: '118200.00' },
      NOVA_SIGNATURE: { basic: '210000.00', gst: '18900.00', final: '228900.00', display_name: 'Nova Signature', net_after_subsidy: '150900.00' },
    },
    subsidy_inr: '78000.00',
    subsidy_conditions: ['dcr_modules_required', 'scheme_eligibility'],
    price_list_version: 1,
  },
}

/** §6 — the contract's submit 422 detail. */
export const SUBMIT_INCOMPLETE: SubmitIncompleteDetail = {
  code: 'incomplete',
  message: 'Before submitting, complete the site survey (bills, layout); get the site survey signed (associate).',
  missing_documents: [],
  missing_site_location: false,
  site_location_unconfirmed: false,
  missing_survey_sections: ['bills', 'layout'],
  survey_unsigned: ['associate'],
}

export function makeOnboarding(over: Partial<Onboarding> = {}): Onboarding {
  return {
    onboarding_id: 501,
    status: 'draft',
    lead_id: 1,
    project_reference_id: 'GNE-WB-RES-2026-00501',
    owner: { associate_id: 'GNA-1', full_name: 'Asha Roy', associate_type: 'associate' },
    customer: { name: 'Bikash Das', mobile: '9800000000', email: null },
    territory: { state: { lgd_code: 19, name: 'West Bengal' }, district: { lgd_code: 340, name: 'Kolkata' }, block: null },
    site_latitude: null,
    site_longitude: null,
    site_location: { present: false, confirmed: false, flags: ['location_missing'] },
    connection_in_customer_name: true,
    property_in_customer_name: true,
    customer_timeline: 'within_3_months',
    // site_assessment echoes every writable input field (backend WRITABLE_INPUT_FIELDS).
    site_assessment: {
      proposal_inputs_id: 9,
      status: 'draft',
      customer_type: 'individual',
      project_family: 'rooftop_solar',
      pin_code: '700001',
      full_address: '12 Park Street, Kolkata',
      site_type: 'rooftop_residential',
      connection_type: 'on_grid',
    },
    documents: [],
    photos: [],
    checklist: { required: [], present: [], missing: [] },
    notice: { version: 'v1', acknowledged_at: '2026-01-01T00:00:00Z', recorded_by: 'GNA-1' },
    verification: { completed: false, verified_at: null },
    attribution: { locked: false, released_reason: null, under_review: false },
    score: null,
    formal_proposal_blocked: null,
    submitted_at: null,
    warnings: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    can_edit: true,
    ...over,
  }
}
