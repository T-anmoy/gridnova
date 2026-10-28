// The Proposal Studio's API shapes (BE-18, docs/api/proposal_studio.md). Amounts are
// decimal strings and are only ever shown — the browser never calculates money: every
// figure comes from the API's `figures`.
//
// Where the contract shows "…" (the document's schema v2, GET /studio/options, the list
// row) the fields below are the ones the BE-18 code returns (app/studio/service.py
// `proposal_json`, `version_json`, `view`; app/api/routes/studio.py `studio_options`) —
// reported as contract gaps in the FE-18 report.

import type { BoqRow, PaymentTerm } from '@/lib/proposals/document-types'

export const STUDIO_STATUSES = [
  'draft',
  'pending_approval',
  'ready',
  'issued',
  'viewed',
  'accepted',
  'declined',
  'expired',
  'superseded',
  'converted',
  'lost',
] as const
export type StudioStatus = (typeof STUDIO_STATUSES)[number]

export type StudioLayout = 'compact' | 'detailed' | 'itemised'
export type StudioPriceMode = 'price_list' | 'staff_basic' | 'staff_total' | 'none'

// ── Options ─────────────────────────────────────────────────────────────────

export interface StudioOptions {
  project_types: { id: string; label: string; layout: string }[]
  packages: { id: string; label: string }[]
  phases: string[]
  categories: string[]
  discoms: string[]
  titles: string[]
  salutations: string[]
  module_technologies: string[]
  item_units: string[]
  item_categories: { id: string; label: string; gst_rate: string }[]
  sections: string[]
  validity_days_default: number
  price_modes: string[]
  assistant_enabled: boolean
}

// ── Customers ───────────────────────────────────────────────────────────────

export type CustomerType = 'individual' | 'organisation'

export interface StudioCustomer {
  id: number
  customer_type: CustomerType
  title: string | null
  name: string
  attention: string | null
  mobile: string
  email: string | null
  address_lines: string[]
  gstin: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string | null
}

export interface DuplicateCustomer {
  id: number
  name: string
  mobile: string
  gstin: string | null
  matched_on: ('mobile' | 'gstin')[]
}

export interface CustomerResponse {
  customer: StudioCustomer
  duplicates: DuplicateCustomer[]
}

export interface CustomerInput {
  customer_type: CustomerType
  title?: string | null
  name: string
  attention?: string | null
  mobile: string
  email?: string | null
  address_lines: string[]
  gstin?: string | null
}

// ── The document (schema 2) ─────────────────────────────────────────────────

export interface StudioAddressee {
  customer_type: CustomerType
  title: string | null
  name: string | null
  attention: string | null
  address_lines: string[]
  mobile: string | null
  aadhaar_last4: string | null
  salutation: string
}

export interface StudioConnection {
  discom: string | null
  consumer_number: string | null
  sub_division: string | null
  sanctioned_load_kw: string | null
  category: string | null
  phase: 'single' | 'three' | null
}

export interface StudioSite {
  address_lines: string[]
  town: string | null
  state: string | null
}

export interface StudioPmSuryaGhar {
  subsidy_opted: boolean
  portal_registered: boolean
  approved_capacity_kwp: string | null
}

export interface StudioPlant {
  capacity_kwp: string | null
  package: 'NOVA_ASSURED' | 'NOVA_SIGNATURE' | null
  dcr: boolean
}

export interface StudioSystem {
  module_technology: string
  inverter: string | null
  mounting: string | null
}

export interface StudioProject {
  project_type: string
  houses: number | null
  roof_area_sqft: string | null
}

export interface StudioItem {
  description: string
  specification: string | null
  make: string
  quantity: string
  unit: string
  unit_rate: string
  category: string
}

export interface StudioDisplay {
  show_discount_line: boolean
  show_savings: boolean
  show_package_comparison: boolean
}

export interface StudioSavingsInputs {
  monthly_units: string | null
  monthly_bill: string | null
  tariff_per_unit: string | null
  fixed_charges: string | null
  export_rate: string | null
}

export interface StudioDiscount {
  amount: string
  reason: string
}

export interface StudioPrice {
  mode: StudioPriceMode
  basic: string | null
  rate_per_kwp: string | null
  total: string | null
  price_list_version: number | null
  list_basic: string | null
  discount: StudioDiscount | null
  reason: string | null
}

export interface StudioDocument {
  schema_version: 2
  revision: number
  segment: string | null
  coverage: string | null
  housing_society: boolean
  mount_type: string
  addressee: StudioAddressee
  connection: StudioConnection
  site: StudioSite
  pm_surya_ghar: StudioPmSuryaGhar
  plant: StudioPlant
  system: StudioSystem
  boq: BoqRow[]
  customer_scope: string[]
  payment_terms: PaymentTerm[]
  notes: string[]
  price: StudioPrice
  edited: string[]
  project: StudioProject
  savings: StudioSavingsInputs | null
  items: StudioItem[]
  display: StudioDisplay
  notes_free: string[]
  cover_highlight: string | null
  validity_days: number
}

// ── Figures (schema 2) — shown, never computed ──────────────────────────────

export interface StudioPayment {
  percent: string
  label: string
  short_label?: string | null
  amount: string
}

export interface StudioSubsidy {
  applies: boolean
  kind?: string
  slabs?: { kw: string; rate: string; amount: string }[]
  total?: string | null
  effective_cost?: string | null
  houses?: number | null
  eligible_kw?: string | null
  limited_by?: string | null
}

export interface StudioSavings {
  monthly_consumption_units: string | null
  tariff_per_unit: string | null
  year1_generation_units: string | null
  year1_savings: string | null
  year1_monthly_savings: string | null
  total_savings_25_years: string | null
  payback_years: string | null
  effective_cost: string | null
  table: { year: number; generation_units: string; self_consumed_units: string; exported_units: string; savings: string; cumulative: string }[]
  note?: string | null
  depreciation_line?: string | null
}

export interface PackageComparisonRow {
  package: string
  name: string
  panels?: string | null
  inverters?: string | null
  basic: string
  gst: string
  total: string
  chosen: boolean
}

export interface StudioItemFigure {
  no: number
  amount: string
  gst_rate: string
  gst: string
  gst_percent: string
}

export interface StudioFigures {
  schema_version?: number
  project_type?: string
  layout: StudioLayout
  capacity_kwp: string | null
  price_mode?: string | null
  basic: string | null
  gst: string | null
  total: string | null
  gst_rate?: string | null
  words?: { basic: string | null; gst: string | null; total: string | null }
  payments: StudioPayment[]
  whole_rupees?: boolean
  subsidy?: StudioSubsidy | null
  validity_days?: number
  list_basic?: string | null
  below_price_master?: { list_basic: string; basic: string; percent: string } | null
  discount?: { price_before_discount: string; amount: string; reason: string } | null
  savings?: StudioSavings | null
  package_comparison?: PackageComparisonRow[] | null
  items?: StudioItemFigure[]
  gst_groups?: { rate: string; percent: string; taxable: string; gst: string }[]
}

// ── The proof-check ─────────────────────────────────────────────────────────

export interface StudioCheck {
  id: string
  level: 'error' | 'warning'
  field: string | null
  message: string
  fingerprint: string
  /** Spelling warnings: the word, for "ignore this word". */
  word?: string
}

// ── The view ────────────────────────────────────────────────────────────────

export interface StudioProposalSummary {
  id: number
  code: string
  title: string
  project_type: string
  status: StudioStatus
  current_version: number
  owner_id: string
  customer: { id: number; name: string; mobile: string } | null
  lead_id: number | null
  lost_reason: string | null
  total: string | null
  document_reference: string | null
  valid_until: string | null
  issued_at: string | null
  created_at?: string
  updated_at?: string
}

export interface StudioVersion {
  version: number
  status: StudioStatus
  locked: boolean
  document_reference: string | null
  document_date: string | null
  valid_until: string | null
  total: string | null
  verification_code: string | null
  pdf_sha256: string | null
  pdf_filename: string | null
  submitted_by: string | null
  submitted_at?: string | null
  approved_by: string | null
  approved_at?: string | null
  approval_comment: string | null
  issued_by: string | null
  issued_at: string | null
  first_viewed_at: string | null
  view_count: number
  accepted_at: string | null
  accepted_via: string | null
  accepted_name: string | null
  declined_at: string | null
  decline_reason: string | null
  supersedes_version: number | null
  change_summary: FieldDiff[]
  spell_ignore: string[]
}

export interface StudioAbilities {
  edit: boolean
  price: boolean
  submit: boolean
  approve: boolean
  issue: boolean
  deliver: boolean
  revise: boolean
  mark_accepted: boolean
  mark_lost: boolean
  convert: boolean
}

export interface StudioView {
  proposal: StudioProposalSummary
  version: StudioVersion
  revision: number
  layout: StudioLayout
  document: StudioDocument
  figures: StudioFigures
  missing_required: { field: string; message: string }[]
  content_blockers: { registry: string; message: string }[]
  checks: StudioCheck[]
  errors: number
  warnings_unacknowledged: string[]
  approval_required: boolean
  approval_reasons: string[]
  signatory: { name: string; title: string; for_line: string }
  versions: { version: number; status: StudioStatus; document_reference: string | null }[]
  can?: StudioAbilities
}

export interface FieldDiff {
  field: string
  before: unknown
  after: unknown
}

export interface SectionEditResponse extends StudioView {
  changes: FieldDiff[]
  regenerated_sections: string[]
  approval_cleared: boolean
}

export interface StudioListResponse {
  items: StudioProposalSummary[]
  total: number
  page: number
  page_size: number
}

export interface StudioListParams {
  status?: string
  project_type?: string
  owner_id?: string
  date_from?: string
  date_to?: string
  q?: string
  page?: number
  page_size?: number
}

export interface StudioSummary {
  drafts: number
  awaiting_approval: number
  issued_this_month: { count: number; value: string }
  viewed_not_accepted: number
  accepted: { count: number; value: string }
  win_rate_90_days: string | number | null
  expiring_in_7_days: number
  median_days_issued_to_accepted: string | number | null
  owner_id: string | null
}

export interface StudioEvent {
  id: number
  version: number | null
  type: string
  actor_type: string
  actor: string | null
  detail: Record<string, unknown> | null
  at: string
}

export interface VersionDiff {
  from: number
  to: number
  changes: FieldDiff[]
}

// ── Library ─────────────────────────────────────────────────────────────────

export type LibraryKind = 'note' | 'customer_scope_item' | 'boq_preset' | 'template'

export interface LibraryItem {
  id: number
  kind: LibraryKind
  name: string
  project_type: string | null
  body: { text?: string; rows?: BoqRow[]; document?: Partial<StudioDocument> }
  active: boolean
  created_by?: string | null
  created_at?: string
}

// ── Import ──────────────────────────────────────────────────────────────────

export interface ImportCreated {
  proposal_id: number
  code: string
  title: string
  duplicate_customers: DuplicateCustomer[] | unknown[]
}

export interface ImportError {
  sheet: string
  cell: string
  field: string
  message: string
}

// ── Assistant ───────────────────────────────────────────────────────────────

export interface AssistantSuggestion {
  section: 'addressee' | 'site' | 'connection'
  field: string
  value: unknown
  status: 'check'
}

export interface AssistantResponse {
  suggestions: AssistantSuggestion[]
  dropped: unknown
  model: string | null
  available: boolean
}

// ── Public: the customer's page and the verification page ───────────────────

export type PublicState = 'open' | 'accepted' | 'declined' | 'superseded' | 'expired'

export interface PublicProposal {
  reference: string | null
  date: string | null
  title: string
  customer_name: string | null
  capacity_kwp: string | null
  layout: string
  basic: string | null
  gst: string | null
  total: string | null
  total_in_words: string | null
  discount: { price_before_discount: string; amount: string; reason: string } | null
  payments: StudioPayment[]
  subsidy: StudioSubsidy | null
  valid_until: string | null
  state: PublicState
  accepted_at: string | null
  pdf_sha256: string | null
  pdf_filename: string | null
  mobile_hint: string | null
  pdf_path: string
}

export type VerifyStatus = 'valid' | 'superseded' | 'expired' | 'accepted' | 'declined'

export interface ProposalVerification {
  reference: string | null
  date: string | null
  capacity_kwp: string | null
  title: string
  total_incl_gst: string | null
  status: VerifyStatus
  valid_until: string | null
  customer: string | null
  issuer: string
}
