// BE-13 fixtures, built from docs/api/proposal_document.md's examples and checked
// against tests/contract/openapi.json (DocumentView, DocumentEditResponse) in
// fe13-contract.test.ts. Amounts are the contract's own example figures — the
// UI only ever displays them.
import type { DocumentEditResponse, DocumentView, ProposalDocument } from '@/lib/proposals/document-types'
import { ApiError } from '@/lib/dashboard/api-error'

export const ALL_SECTIONS = ['addressee', 'connection', 'site', 'pm_surya_ghar', 'plant', 'system', 'boq', 'customer_scope', 'payment_terms', 'notes']

export function makeDocument(over: Partial<ProposalDocument> = {}): ProposalDocument {
  return {
    schema_version: 1,
    revision: 3,
    segment: 'residential',
    coverage: null,
    housing_society: false,
    mount_type: 'rooftop',
    addressee: {
      customer_type: 'individual',
      title: null,
      name: 'Asha Roy',
      attention: null,
      address_lines: ['12 Lake Road', 'Habra, West Bengal – 743263'],
      mobile: '9800000001',
      aadhaar_last4: null,
      salutation: 'Dear Sir / Madam,',
    },
    connection: { discom: null, consumer_number: '1234567', sub_division: null, sanctioned_load_kw: '5', category: 'Residential', phase: 'single' },
    site: { address_lines: ['12 Lake Road'], town: 'Habra', state: 'West Bengal' },
    pm_surya_ghar: { subsidy_opted: true, portal_registered: false, approved_capacity_kwp: null },
    plant: { capacity_kwp: '3', package: 'NOVA_ASSURED', dcr: true },
    system: { module_technology: 'Mono PERC', inverter: null, mounting: null },
    boq: [
      { description: 'Solar PV Modules – {module_technology}, {dcr_label}', quantity: '{capacity_kwp} kWp', standard: null, make: 'Sova Solar / HR Solar / Equivalent', kind: 'module' },
      { description: 'Grid-tied inverter', quantity: '1 No.', standard: null, make: 'Equivalent', kind: 'inverter' },
    ],
    customer_scope: ['Shadow-free roof area of {space_required_sqft} sq ft.', 'Safe access to the roof.'],
    payment_terms: [
      { percent: '20', label: 'On Order', short_label: null },
      { percent: '60', label: 'Against Material Bill', short_label: null },
      { percent: '20', label: 'Before Commissioning', short_label: null },
    ],
    notes: [],
    price: { mode: 'price_list', basic: '185000.00', rate_per_kwp: null, total: '201465.00', price_list_version: 2 },
    defaults: {},
    edited: [],
    ...over,
  }
}

export const FIGURES = {
  layout: 'compact',
  capacity_kwp: '3',
  price_mode: 'price_list',
  basic: '185000.00',
  gst: '16465.00',
  total: '201465.00',
  gst_rate: '0.089',
  words: { basic: 'Rupees One Lakh Eighty-Five Thousand Only', gst: 'Rupees Sixteen Thousand Four Hundred Sixty-Five Only', total: 'Rupees Two Lakh One Thousand Four Hundred Sixty-Five Only' },
  payments: [
    { percent: '20', label: 'On Order', short_label: null, amount: '40293.00' },
    { percent: '60', label: 'Against Material Bill', short_label: null, amount: '120879.00' },
    { percent: '20', label: 'Before Commissioning', short_label: null, amount: '40293.00' },
  ],
  whole_rupees: true,
  subsidy: {
    applies: true,
    slabs: [
      { kw: '2', rate: '30000.00', amount: '60000.00' },
      { kw: '1', rate: '18000.00', amount: '18000.00' },
    ],
    total: '78000.00',
    effective_cost: '123465.00',
  },
  generation: { units_per_kwp_per_month: 120, monthly_units: 360, annual_units: 4320 },
  space_required_sqft: { low: 250, high: 300, single: 200 },
  validity_days: 15,
}

export const SIGNATORY_FIXTURE = { name: 'SIGNATORY FROM API', title: 'Authorised Signatory', for_line: 'For Grid Nova Energy' }

export function documentView(over: Partial<DocumentView> = {}): DocumentView {
  return {
    proposal_id: 12,
    has_document: true,
    version: 1,
    status: 'draft',
    revision: 3,
    layout: 'compact',
    locked: false,
    editable_sections: [...ALL_SECTIONS],
    document: makeDocument(),
    figures: FIGURES,
    missing_required: [{ field: 'connection.discom', message: 'the DISCOM' }],
    document_reference: null,
    document_date: null,
    signatory: SIGNATORY_FIXTURE,
    ...over,
  }
}

/** Engineer: technical part only — no customer, contact or price. */
export function technicalView(over: Partial<DocumentView> = {}): DocumentView {
  return {
    proposal_id: 12,
    has_document: true,
    version: 1,
    status: 'draft',
    revision: 3,
    layout: 'compact',
    locked: false,
    editable_sections: ['system', 'boq'],
    document: { view: 'technical', revision: 3, plant: { capacity_kwp: '3', dcr: true }, system: makeDocument().system, boq: makeDocument().boq },
    figures: null,
    missing_required: null,
    document_reference: null,
    document_date: null,
    signatory: null,
    ...over,
  }
}

export const NO_DOCUMENT_VIEW: DocumentView = { proposal_id: 7, has_document: false, editable_sections: [] }

export function editResponse(over: Partial<DocumentEditResponse> = {}): DocumentEditResponse {
  return {
    ...documentView({ revision: 4 }),
    changes: [{ field: 'connection.discom', before: null, after: 'WBSEDCL' }],
    regenerated_sections: [],
    total_value: 201465.0,
    requires_manager_signoff: false,
    ...over,
  }
}

export function docError(status: number, detail: Record<string, unknown>, retryAfter?: number): ApiError {
  return new ApiError(status, `API error ${status}`, typeof detail.message === 'string' ? detail.message : undefined, detail, retryAfter)
}

export const ACCEPT_DOCUMENT = {
  layout: 'compact',
  capacity_kwp: '3',
  reference: 'GN/23/10/2026/01',
  date: '2026-10-23',
  basic: '185000.00',
  gst: '16465.00',
  total: '201465.00',
  words: 'Rupees Two Lakh One Thousand Four Hundred Sixty-Five Only',
  payments: FIGURES.payments,
  subsidy: FIGURES.subsidy,
  generation: FIGURES.generation,
  customer_scope: ['Shadow-free roof area of 250–300 sq ft.'],
}

/** GET /api/v1/proposals/accept/{token} for a BE-13 proposal (public_proposals._summary). */
export const ACCEPT_GET_WITH_DOCUMENT = {
  proposal_id: 12,
  version: 1,
  scope: [],
  price: 201465.0,
  document: ACCEPT_DOCUMENT,
  valid_until: '2026-11-07',
  state: 'acceptable',
  accepted_at: null,
  pdf_available: true,
}
