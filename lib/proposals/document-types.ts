// BE-13 proposal document — shapes from docs/api/openapi.json (DocumentView,
// DocumentEditResponse, ProposalDocument, TechnicalDocument, DocumentFigures)
// and docs/api/proposal_document.md. Decimals travel as strings and are only
// ever displayed: every figure is the backend's.

export const DOCUMENT_SECTIONS = [
  'addressee',
  'connection',
  'site',
  'pm_surya_ghar',
  'plant',
  'system',
  'boq',
  'customer_scope',
  'payment_terms',
  'notes',
] as const

export type DocumentSection = (typeof DOCUMENT_SECTIONS)[number]

export type DocumentLayout = 'compact' | 'detailed'

export type PriceMode = 'price_list' | 'staff_basic' | 'staff_total' | 'none'

export interface Addressee {
  customer_type?: 'individual' | 'organisation'
  title?: string | null
  name?: string | null
  attention?: string | null
  address_lines?: string[]
  mobile?: string | null
  aadhaar_last4?: string | null
  salutation?: string
}

export type ConnectionCategory = 'Residential' | 'Commercial' | 'Industrial' | 'Government' | 'Agricultural'

export interface Connection {
  discom?: string | null
  consumer_number?: string | null
  sub_division?: string | null
  sanctioned_load_kw?: string | null
  category?: ConnectionCategory | null
  phase?: 'single' | 'three' | null
}

export interface Site {
  address_lines?: string[]
  town?: string | null
  state?: string | null
}

export interface PmSuryaGhar {
  subsidy_opted?: boolean
  portal_registered?: boolean
  approved_capacity_kwp?: string | null
}

export interface Plant {
  capacity_kwp?: string | null
  package?: 'NOVA_ASSURED' | 'NOVA_SIGNATURE' | null
  dcr?: boolean
}

export interface SystemSpec {
  module_technology?: string
  inverter?: string | null
  mounting?: string | null
}

export interface BoqRow {
  description: string
  quantity: string
  standard?: string | null
  make: string
  kind?: 'module' | 'inverter' | 'cable' | null
}

export interface PaymentTerm {
  percent: string
  label: string
  short_label?: string | null
}

export interface Price {
  mode: PriceMode
  basic?: string | null
  rate_per_kwp?: string | null
  total?: string | null
  price_list_version?: number | null
}

export interface ProposalDocument {
  schema_version?: number
  revision?: number
  segment?: string | null
  coverage?: string | null
  housing_society?: boolean
  mount_type?: 'rooftop' | 'ground_mounted'
  addressee: Addressee
  connection: Connection
  site: Site
  pm_surya_ghar: PmSuryaGhar
  plant: Plant
  system: SystemSpec
  boq: BoqRow[]
  customer_scope: string[]
  payment_terms: PaymentTerm[]
  notes: string[]
  price: Price
  defaults?: Record<string, unknown>
  edited?: string[]
}

/** The Engineer's view: no customer, contact or price. */
export interface TechnicalDocument {
  view: 'technical'
  revision: number
  plant: { capacity_kwp?: string | null; dcr: boolean }
  system: SystemSpec
  boq: BoqRow[]
}

export interface PaymentFigure {
  percent: string
  label: string
  short_label?: string | null
  amount: string
}

export interface SubsidyFigures {
  applies: boolean
  slabs: { kw: string; rate: string; amount: string }[]
  total?: string | null
  effective_cost?: string | null
}

export interface DocumentFigures {
  layout: string
  capacity_kwp?: string | null
  price_mode: string
  basic?: string | null
  gst?: string | null
  total?: string | null
  gst_rate: string
  words: { basic?: string | null; gst?: string | null; total?: string | null }
  payments: PaymentFigure[]
  whole_rupees: boolean
  subsidy: SubsidyFigures
  generation: { units_per_kwp_per_month: number; monthly_units?: number | null; annual_units?: number | null }
  space_required_sqft?: { low: number; high: number; single: number } | null
  validity_days: number
}

export interface MissingField {
  field: string
  message: string
}

export interface Signatory {
  name: string
  title: string
  for_line: string
}

/** GET /api/v1/dashboard/proposals/{id}/document (also `document` on the proposal detail). */
export interface DocumentView {
  proposal_id: number
  has_document: boolean
  version?: number | null
  status?: string | null
  revision?: number | null
  layout?: string | null
  locked?: boolean | null
  editable_sections?: string[]
  document?: ProposalDocument | TechnicalDocument | null
  figures?: DocumentFigures | null
  missing_required?: MissingField[] | null
  document_reference?: string | null
  document_date?: string | null
  signatory?: Signatory | null
}

export interface FieldChange {
  field: string
  before?: unknown
  after?: unknown
}

/** PATCH /api/v1/dashboard/proposals/{id}/document — the GET object plus the edit's outcome. */
export interface DocumentEditResponse extends DocumentView {
  changes: FieldChange[]
  regenerated_sections: string[]
  total_value?: number | null
  requires_manager_signoff?: boolean | null
}

export interface DocumentEditInput {
  proposalId: number
  base_revision: number
  section: DocumentSection
  value: Record<string, unknown> | unknown[]
}

/** The accept page's `document` (GET /api/v1/proposals/accept/{token}); null for an older proposal. */
export interface AcceptDocument {
  layout?: string | null
  capacity_kwp?: string | null
  reference?: string | null
  date?: string | null
  basic?: string | null
  gst?: string | null
  total?: string | null
  // The backend sends the total in words (a string); tolerate the figures' object form too.
  words?: string | { total?: string | null } | null
  payments?: PaymentFigure[]
  subsidy?: SubsidyFigures | null
  generation?: DocumentFigures['generation'] | null
  customer_scope?: string[]
}

export function isTechnicalDocument(doc: DocumentView['document']): doc is TechnicalDocument {
  return !!doc && (doc as TechnicalDocument).view === 'technical'
}
