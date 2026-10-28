// BE-18 Proposal Studio fixtures (docs/api/proposal_studio.md §5 View, §11 public), in the
// shapes the BE-18 code returns. Amounts are decimal strings, as the API sends them.
import { vi } from 'vitest'
import type { PublicProposal, StudioOptions, StudioView, ProposalVerification } from '@/lib/studio/types'

export const OPTIONS: StudioOptions = {
  project_types: [
    { id: 'residential_rooftop', label: 'Residential rooftop', layout: 'compact_or_detailed' },
    { id: 'housing_society', label: 'Housing society / RWA', layout: 'detailed' },
    { id: 'commercial_rooftop', label: 'Commercial rooftop', layout: 'compact_or_detailed' },
    { id: 'street_lighting', label: 'Street lighting and other itemised supply', layout: 'itemised' },
  ],
  packages: [
    { id: 'NOVA_ASSURED', label: 'Nova Assured' },
    { id: 'NOVA_SIGNATURE', label: 'Nova Signature' },
  ],
  phases: ['single', 'three'],
  categories: ['Residential', 'Commercial', 'Industrial', 'Government', 'Agricultural'],
  discoms: ['WBSEDCL', 'CESC', 'NBPDCL', 'SBPDCL'],
  titles: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'M/s'],
  salutations: ['Dear Sir / Madam,', 'Dear Sir,', 'Dear Madam,'],
  module_technologies: ['Mono PERC', 'TOPCon'],
  item_units: ['Nos.', 'Set', 'Mtr.'],
  item_categories: [{ id: 'street_light', label: 'Street light', gst_rate: '0.12' }],
  sections: ['addressee', 'site', 'connection', 'plant', 'boq', 'price'],
  validity_days_default: 15,
  price_modes: ['price_list', 'staff_basic', 'staff_total', 'none'],
  assistant_enabled: false,
}

type Patch = Partial<Omit<StudioView, 'proposal' | 'version' | 'document' | 'figures' | 'can'>> & {
  proposal?: Partial<StudioView['proposal']>
  version?: Partial<StudioView['version']>
  document?: Partial<StudioView['document']>
  figures?: Partial<StudioView['figures']>
  can?: Partial<NonNullable<StudioView['can']>>
}

export function makeView(p: Patch = {}): StudioView {
  const base: StudioView = {
    proposal: {
      id: 7, code: 'SP-000007', title: '3 kWp Residential rooftop — Test Kumar Das', project_type: 'residential_rooftop',
      status: 'draft', current_version: 1, owner_id: 'user_test', customer: { id: 3, name: 'Test Kumar Das', mobile: '9830000001' },
      lead_id: null, lost_reason: null, total: '201465.00', document_reference: null, valid_until: null, issued_at: null,
      created_at: '2026-10-27T05:00:00+00:00', updated_at: '2026-10-27T05:10:00+00:00',
    },
    version: {
      version: 1, status: 'draft', locked: false, document_reference: null, document_date: null, valid_until: null,
      total: '201465.00', verification_code: null, pdf_sha256: null, pdf_filename: null, submitted_by: null, approved_by: null,
      approval_comment: null, issued_by: null, issued_at: null, first_viewed_at: null, view_count: 0, accepted_at: null,
      accepted_via: null, accepted_name: null, declined_at: null, decline_reason: null, supersedes_version: null,
      change_summary: [], spell_ignore: [],
    },
    revision: 5,
    layout: 'compact',
    document: {
      schema_version: 2, revision: 5, segment: 'residential', coverage: null, housing_society: false, mount_type: 'rooftop',
      addressee: { customer_type: 'individual', title: 'Mr.', name: 'Test Kumar Das', attention: null, address_lines: ['12 Lake Road', 'Habra, West Bengal – 743263'], mobile: '9830000001', aadhaar_last4: null, salutation: 'Dear Sir / Madam,' },
      connection: { discom: 'WBSEDCL', consumer_number: '1234567', sub_division: null, sanctioned_load_kw: '2', category: 'Residential', phase: 'single' },
      site: { address_lines: ['12 Lake Road'], town: 'Habra', state: 'West Bengal' },
      pm_surya_ghar: { subsidy_opted: false, portal_registered: false, approved_capacity_kwp: null },
      plant: { capacity_kwp: '3', package: 'NOVA_ASSURED', dcr: true },
      system: { module_technology: 'Mono PERC', inverter: null, mounting: null },
      boq: [
        { description: 'Solar PV modules', quantity: '6 Nos.', standard: 'IS 14286', make: 'Waaree / Equivalent', kind: 'module' },
        { description: 'Grid-tied inverter', quantity: '1 No.', standard: null, make: 'Sungrow', kind: 'inverter' },
      ],
      customer_scope: ['Shadow-free roof space.'],
      payment_terms: [
        { percent: '20', label: 'Advance with the order' },
        { percent: '60', label: 'On delivery of materials' },
        { percent: '20', label: 'On commissioning' },
      ],
      notes: [],
      price: { mode: 'price_list', basic: '185000', rate_per_kwp: null, total: null, price_list_version: 3, list_basic: '185000', discount: null, reason: null },
      edited: [],
      project: { project_type: 'residential_rooftop', houses: null, roof_area_sqft: null },
      savings: null,
      items: [],
      display: { show_discount_line: false, show_savings: false, show_package_comparison: false },
      notes_free: [],
      cover_highlight: null,
      validity_days: 15,
    },
    figures: {
      schema_version: 2, project_type: 'residential_rooftop', layout: 'compact', capacity_kwp: '3', price_mode: 'price_list',
      basic: '185000.00', gst: '16465.00', total: '201465.00', gst_rate: '0.089',
      words: { basic: 'Rupees One Lakh Eighty-Five Thousand Only', gst: 'Rupees Sixteen Thousand Four Hundred Sixty-Five Only', total: 'Rupees Two Lakh One Thousand Four Hundred Sixty-Five Only' },
      payments: [
        { percent: '20', label: 'Advance with the order', amount: '40293.00' },
        { percent: '60', label: 'On delivery of materials', amount: '120879.00' },
        { percent: '20', label: 'On commissioning', amount: '40293.00' },
      ],
      whole_rupees: true, subsidy: { applies: false }, validity_days: 15, list_basic: '185000', below_price_master: null, discount: null,
      savings: null, package_comparison: null,
    },
    missing_required: [],
    content_blockers: [],
    checks: [],
    errors: 0,
    warnings_unacknowledged: [],
    approval_required: false,
    approval_reasons: [],
    signatory: { name: 'RAJU PAUL', title: 'Authorised Signatory', for_line: 'For Grid Nova Energy' },
    versions: [{ version: 1, status: 'draft', document_reference: null }],
    can: { edit: true, price: true, submit: true, approve: false, issue: true, deliver: false, revise: false, mark_accepted: false, mark_lost: true, convert: false },
  }
  return {
    ...base,
    ...p,
    proposal: { ...base.proposal, ...p.proposal },
    version: { ...base.version, ...p.version },
    document: { ...base.document, ...p.document },
    figures: { ...base.figures, ...p.figures },
    can: { ...base.can!, ...p.can },
  } as StudioView
}

/** An issued, open version (as after POST …/issue). */
export function issuedView(p: Patch = {}): StudioView {
  return makeView({
    ...p,
    proposal: { status: 'issued', document_reference: 'GN/27/10/2026/01', valid_until: '2026-11-11', issued_at: '2026-10-27T06:00:00+00:00', ...p.proposal },
    version: {
      status: 'issued', locked: true, document_reference: 'GN/27/10/2026/01', document_date: '2026-10-27', valid_until: '2026-11-11',
      verification_code: 'ABCD2345EFGH', pdf_sha256: 'f'.repeat(64), pdf_filename: 'GridNova_Proposal_GN-27-10-2026-01_3kWp_TestKumarDas.pdf',
      issued_by: 'user_test', issued_at: '2026-10-27T06:00:00+00:00', ...p.version,
    },
    can: { edit: false, price: false, submit: false, issue: false, deliver: true, revise: true, mark_accepted: true, mark_lost: true, convert: true, ...p.can },
    versions: p.versions ?? [{ version: 1, status: 'issued', document_reference: 'GN/27/10/2026/01' }],
  })
}

export const PUBLIC_OPEN: PublicProposal = {
  reference: 'GN/27/10/2026/01', date: '2026-10-27', title: '3 kWp Residential rooftop — Test Kumar Das', customer_name: 'Test Kumar Das',
  capacity_kwp: '3', layout: 'compact', basic: '185000.00', gst: '16465.00', total: '201465.00',
  total_in_words: 'Rupees Two Lakh One Thousand Four Hundred Sixty-Five Only', discount: null,
  payments: [
    { percent: '20', label: 'Advance with the order', amount: '40293.00' },
    { percent: '80', label: 'On commissioning', amount: '161172.00' },
  ],
  subsidy: { applies: true, total: '78000.00', effective_cost: '123465.00', kind: 'pm_surya_ghar' },
  valid_until: '2026-11-11', state: 'open', accepted_at: null, pdf_sha256: 'f'.repeat(64),
  pdf_filename: 'GridNova_Proposal.pdf', mobile_hint: 'XXXXXX0001', pdf_path: '/api/v1/public/studio/tok-1/pdf',
}

export const VERIFIED: ProposalVerification = {
  reference: 'GN/27/10/2026/01', date: '2026-10-27', capacity_kwp: '3', title: '3 kWp Residential rooftop',
  total_incl_gst: '201465.00', status: 'valid', valid_until: '2026-11-11', customer: 'Test K.', issuer: 'Grid Nova Energy',
}

// ── A stubbed backend for the Studio routes ─────────────────────────────────

type ReplyValue = { status?: number; body?: unknown; raw?: BodyInit; type?: string }
export type StudioReply = ReplyValue | ((req: { body: unknown; url: string; form?: FormData }) => ReplyValue)

export interface StudioCall {
  method: string
  path: string
  body: unknown
  form?: FormData
}

/**
 * `fetch` answers from a table keyed "METHOD /path?query" (path after /api/v1). A route not in
 * the table answers 404, so a request the screen should not make shows up.
 */
export function studioBackend(routes: Record<string, StudioReply>) {
  const calls: StudioCall[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^https?:\/\/[^/]+\/api\/v1/, '')
    const form = init?.body instanceof FormData ? init.body : undefined
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body, form })
    const reply = routes[`${method} ${path}`] ?? routes[`${method} ${path.split('?')[0]}`]
    if (!reply) return new Response(JSON.stringify({ detail: `no fake route for ${method} ${path}` }), { status: 404 })
    const r = typeof reply === 'function' ? reply({ body, url, form }) : reply
    if (r.raw !== undefined) return new Response(r.raw, { status: r.status ?? 200, headers: { 'Content-Type': r.type ?? 'application/octet-stream' } })
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    on(key: string, reply: StudioReply) {
      routes[key] = reply
    },
    called: (method: string, path: string) => calls.filter((c) => c.method === method && c.path.split('?')[0] === path),
  }
}

export const refused = (status: number, code: string, extra: Record<string, unknown> = {}) => ({
  status,
  body: { detail: { code, message: `server words for ${code}`, ...extra } },
})
