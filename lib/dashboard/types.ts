import type { ReverificationReason } from "./survey-review-types"

// The role ids the backend knows (access_control.md §1). A type only: what a person may do
// comes from GET /employees/me `permissions`, and role names are shown through
// lib/access/roles.ts — no screen compares them.
export type Role = 'admin' | 'sales' | 'management' | 'network_manager' | 'engineer' | 'operations' | 'accounts'

// ── Equipment / SKU master ───────────────────────────────────────────────────

export type EquipmentCategory = 'module' | 'inverter' | 'structure' | 'bos_component'

export interface Equipment {
  id: number
  category: EquipmentCategory
  brand: string
  model_name: string
  specification: string | null
  is_dcr_compliant: boolean
  procurement_price_inr: number | null
  is_active: boolean
  created_at: string | null
  // A development-only dummy catalogue row — never real stock.
  is_placeholder?: boolean
}

export interface EquipmentListParams {
  category?: EquipmentCategory
  is_active?: boolean
}

export interface EquipmentCreateInput {
  category: EquipmentCategory
  brand: string
  model_name: string
  specification?: string
  is_dcr_compliant?: boolean
  procurement_price_inr?: number
}

export type PipelineStage =
  | 'new'
  | 'qualifying'
  | 'qualified'
  | 'proposal_draft'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost'

export type ProposalStatus =
  | 'draft'
  | 'pending_pricing_validation'
  | 'pending_approval'
  | 'revision_requested'
  | 'approved'
  | 'sent'

export type LeadScore = 'high' | 'medium' | 'low'

export interface Customer {
  id: number
  name: string
  company: string | null
  email: string
}

export interface LeadSummary {
  id: number
  customer_id: number
  customer_name?: string | null
  pipeline_stage: PipelineStage
  // null until the lead has been scored (staff_contracts.md §2).
  lead_score: LeadScore | null
  source: string
  created_at: string
  assigned_employee_id?: string | null
  project_reference_id?: string | null
  // BE-10: the Associate whose referral link the enquiry came through.
  referred_by?: ReferredBy | null
}

export interface ReferredBy {
  associate_id: string
  full_name: string
}

export interface ProjectRecord {
  id: number
  reference_id: string
  project_type: string | null
  project_family: string | null
  state: string | null
  location: string | null
  capacity_kw: number | null
  roof_type: string | null
  monthly_electricity_bill: number | null
  budget: number | null
  timeline: string | null
  created_at: string | null
}

export interface LeadDetail {
  lead_id: number
  customer: Customer | null
  pipeline_stage: PipelineStage
  // BE-10, non-Engineer detail only.
  referred_by?: ReferredBy | null
  lead_score: LeadScore | null
  collected_fields: Record<string, unknown> | null
  assigned_employee_id?: string | null
  project?: ProjectRecord | null
  proposals: Array<{
    id: number
    version: number
    status: ProposalStatus
    total_value: number | null
  }>
  timeline: Array<{
    event_type: string
    description: string
    created_at: string
  }>
  messages: Array<{
    role: string
    content: string
    created_at: string
  }>
}

// PATCH /leads/{id}/stage
export type LeadAssignmentFilter = 'me' | 'unassigned' | 'any'

export interface LeadStageChangeInput {
  leadId: number
  stage: PipelineStage
  reason?: string | null
}

export interface LeadStageChangeResponse {
  lead_id: number
  previous_stage: PipelineStage
  pipeline_stage: PipelineStage
  reason: string | null
}

// PATCH /leads/{id}/assign — admin/management only
export interface LeadReassignInput {
  leadId: number
  employeeId: string
}

export interface LeadReassignResponse {
  lead_id: number
  previous_assigned_employee_id: string | null
  assigned_employee_id: string
}

// POST /leads — staff-entered manual lead
export type LeadSource = 'whatsapp' | 'cold_call' | 'referral' | 'other'
export type ManualProjectType = 'rooftop' | 'ground_mounted' | 'solar_pump'

export interface CreateLeadInput {
  name: string
  phone?: string
  email?: string
  source: LeadSource
  location?: string
  project_type?: ManualProjectType
  capacity_kw?: number
  monthly_electricity_bill?: number
  notes?: string
}

export interface CreateLeadResponse {
  lead_id: number
  customer_id: number
  customer_matched_existing: boolean
  project_id: number
  project_reference_id: string
  source: string
  pipeline_stage: PipelineStage
  lead_score: LeadScore
  assigned_employee_id: string | null
  is_qualified: boolean
  missing_fields: string[]
}

// PATCH /leads/{id}/fields — qualification fields editor
export interface UpdateLeadFieldsResponse {
  lead_id: number
  collected_fields: Record<string, unknown>
  is_qualified: boolean
  missing_fields: string[]
}

export interface ProposalVersion {
  id: number
  version: number
  status: ProposalStatus
  total_value: number | null
  date_created: string | null
}

export interface ProposalSummary {
  id: number
  lead_id: number
  version: number
  status: ProposalStatus
  total_value: number | null
  requires_manager_signoff: boolean
  // Raw storage address — never open/render this directly (won't resolve).
  // Use `pdf_available` to decide whether to show a download control, and
  // fetch a fresh signed link from GET /proposals/{id}/pdf on click.
  pdf_url: string | null
  pdf_available?: boolean
  // See the identical note on ProposalDetail — accept_url is the real link,
  // accept_path is the backend's own API path and must never be linked.
  accept_url?: string | null
  accept_path?: string | null
  accepted_at?: string | null
  has_placeholder_content?: boolean
  placeholder_sections?: string[]
  // BE-2 §9: a survey change flagged this proposal; it cannot reach the customer until cleared.
  needs_reverification?: boolean
  reverification_reason?: ReverificationReason | null
  date_created: string | null
  date_sent: string | null
  lead: {
    id: number
    pipeline_stage: PipelineStage
    lead_score: LeadScore
  } | null
  customer: Customer | null
}

export interface ProposalContent {
  project_overview?: string
  scope_of_work?: string
  warranty_support?: string
  terms_conditions?: string
  // PM-A price-list snapshot (§5) — the amounts are exact decimal strings.
  pricing?: ProposalPricingSnapshot
  price_list?: { version: string; source_sha256: string }
  [key: string]: unknown
}

export interface ProposalPricingSnapshot {
  price_status: 'list_price' | 'custom_quote'
  package?: string | null
  package_name?: string | null
  phase?: string | null
  kw?: number | string | null
  basic?: string
  gst?: string
  final?: string
  gst_rule?: { effective_rate: string; description?: string } | null
  price_list_version?: string
  source_sha256?: string
  destination?: string
  custom_quote_reasons?: string[]
  // After PATCH …/adjust-pricing.
  adjusted?: boolean
  list_price_final?: string
  variance?: string | null
}

export interface ProposalDetail {
  id: number
  lead_id: number
  version: number
  status: ProposalStatus
  content: ProposalContent | null
  total_value: number | null
  requires_manager_signoff: boolean
  revision_reason: string | null
  // Raw storage address — never open/render this directly (won't resolve).
  // Use `pdf_available` to decide whether to show a download control, and
  // fetch a fresh signed link from GET /proposals/{id}/pdf on click.
  pdf_url: string | null
  pdf_available?: boolean
  date_created: string | null
  date_sent: string | null
  // Customer accept-link status (populated once the proposal is sent).
  // `accept_url` (Prompt 02c, backend-confirmed) is the real full website URL
  // — always use it. `accept_path` is the backend's own API path
  // (`/api/v1/proposals/accept/{token}`) and must never be rendered or
  // linked directly; it's only present here so the schema tolerates it.
  accept_url?: string | null
  accept_path?: string | null
  accepted_at?: string | null
  has_placeholder_content?: boolean
  placeholder_sections?: string[]
  needs_reverification?: boolean
  reverification_reason?: ReverificationReason | null
  customer: Customer | null
  lead: {
    id: number
    pipeline_stage: PipelineStage
    lead_score: LeadScore
  } | null
  versions: ProposalVersion[]
  // BE-13: the structured document, its figures and what blocks approval (the
  // same object as GET …/document; `has_document: false` for an older proposal).
  document?: import('@/lib/proposals/document-types').DocumentView | null
}

// PATCH /proposals/{id}/adjust-pricing — verified against the real backend
// source (Prompt 03b). Who: admin and sales (`can_adjust_pricing`) — never
// management. Sales is further scoped by the Sales rule (own/unassigned).
// BE-13: exactly ONE of new_value (total incl. GST), basic_price (before GST) or
// rate_per_kwp (× the document's capacity); the last two need a structured document.
export type AdjustPricingInput = { proposalId: number; reason: string } & (
  | { newValue: number; basicPrice?: never; ratePerKwp?: never }
  | { basicPrice: string; newValue?: never; ratePerKwp?: never }
  | { ratePerKwp: string; newValue?: never; basicPrice?: never }
)

export interface AdjustPricingResponse {
  status: 'pricing_adjusted'
  proposal_id: number
  total_value: number
  requires_manager_signoff: boolean
  reason: string
  list_price_final?: string | null
  variance?: string | null
  // BE-13: the document's computed figures (null for a proposal without a document).
  figures?: import('@/lib/proposals/document-types').DocumentFigures | null
}

// POST /proposals/{id}/send (200)
export type CustomerEmailSkippedReason =
  | 'email_not_configured'
  | 'no_customer'
  | 'no_customer_email'
  | 'placeholder_customer_email'
  | 'no_accept_link'
  | 'send_failed'

export interface SendProposalResponse {
  status: string
  proposal_id: number
  customer_email_sent: boolean
  customer_email_skipped_reason: CustomerEmailSkippedReason | null
}

// POST /proposals/{id}/send — 409 structured detail (placeholder content)
export interface PlaceholderContentDetail {
  code: 'placeholder_content'
  message: string
  placeholder_sections: string[]
  missing_total_value: boolean
}

// GET /proposals/{id}/pdf
export interface ProposalPdfResponse {
  pdf_url?: string
  status?: 'pdf_pending'
  proposal_id: number
  expires_at?: string
}

export interface ApiErrorDetail {
  code: string
  message: string
  [key: string]: unknown
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}

export interface AnalyticsResponse {
  new_leads_count: number | null
  qualification_completion_rate: number | null
  lead_to_proposal_conversion_rate: number | null
  avg_proposal_turnaround_hours: number | null
  funnel: {
    new: number
    qualified: number
    proposal_sent: number
    won: number
  } | null
  ai_call_count: number | null
  ai_estimated_cost: number | null
  escalation_rate: number | null
}

// ── Reporting (new analytics endpoints) ─────────────────────────────────────

export interface ConversionBySource {
  source: string
  total_leads: number
  won_leads: number
  conversion_rate: number | null // 0..1
}

export interface DealSizeByTier {
  tier: string
  proposal_count: number
  average_value: number | null
  total_value: number | null
}

export interface RepPerformance {
  employee_id: string
  name: string
  leads_handled: number
  proposals_drafted: number
  proposals_won: number
  avg_time_to_close_hours: number | null
}

export interface PipelineTrendPoint {
  week_start: string // ISO date (week start) or label
  leads_created: number
  proposals_won: number
}

export interface Employee {
  id: string
  name: string
  email: string
  /** The primary role (the first held in the backend's order). */
  role: Role
  /** BE-17: every role held; permissions are their union. */
  roles?: Role[]
  /** BE-17: TerritoryState names; empty = every region. */
  regions?: string[]
  is_active: boolean
  created_at: string | null
  google_calendar_connected?: boolean
}

// GET /employees/assignable — admin + management, trimmed for the reassign
// picker (no email/status noise the picker doesn't need).
export interface AssignableEmployee {
  id: string
  name: string
  role: Role
}

// GET /employees/me (access_control.md §2)
export interface EmployeeMe {
  id: string
  /** The primary role — for display only; decisions use `permissions`. */
  role: Role
  roles: Role[]
  permissions: string[]
  two_factor_ok: boolean
  requires_two_factor: boolean
  can_assign_roles: Role[]
  regions: string[]
  is_active: boolean
  google_calendar_connected: boolean
}

export type CalendarErrorReason =
  | 'invalid_state'
  | 'access_denied'
  | 'consent_failed'
  | 'missing_code'
  | 'not_configured'
  | 'exchange_failed'
  | 'employee_not_found'

// POST /employees/me/calendar/connect
export interface CalendarConnectResponse {
  authorization_url: string
}

// ── Agent governance ─────────────────────────────────────────────────────────

export type AgentId = 'sales_agent' | 'proposal_agent' | 'memory_agent'

export interface GovernedAgent {
  id: AgentId
  name: string
  enabled: boolean
  override_source: 'database' | 'env_var'
  daily_action_limit_per_lead: number
}

export interface GovernanceAgentsResponse {
  agents: GovernedAgent[]
  action_budget: {
    replies_per_lead_per_24h: number
    scope: string
  }
}

export interface AgentAuditEntry {
  action: string
  performed_by: string | null
  before_value: unknown
  after_value: unknown
  created_at: string | null
}

export interface AgentAuditResponse {
  agent_id: string
  items: AgentAuditEntry[]
}

export interface AuditLog {
  id: number
  entity_type: string
  entity_id: string | number
  action: string
  performed_by: string
  before_value: unknown
  after_value: unknown
  created_at: string | null
}

export interface DraftProposalResponse {
  proposal_id: number
  lead_id: number
  version: number
  status: ProposalStatus
  requires_manager_signoff: boolean
  total_value: number | null
  missing_fields: string[]
}

// GET /dashboard/leads (BE-1 §2, staff_contracts.md §3). Every filter runs on
// the server before pagination, so `total` is the filtered count. `stage` is
// sent as a repeated query param; dates are IST calendar days (YYYY-MM-DD).
export interface LeadListParams {
  stage?: PipelineStage[]
  min_score?: LeadScore
  max_score?: LeadScore
  created_from?: string
  created_to?: string
  // BE-10 (associate_ease.md §1.4): leads from that Associate's referral link.
  referred_by_associate_id?: string
  source?: string
  // Sales-scoping filter (Prompt 02b): 'any' means own + unassigned for
  // Sales specifically — any other role sending a non-empty value gets a 422.
  assigned?: LeadAssignmentFilter
  // Customer name / email / phone / lead id (≤ 100 chars). Engineers: lead id only.
  q?: string
  page?: number
  page_size?: number
}

export interface ProposalListParams {
  status?: ProposalStatus
  date_from?: string
  date_to?: string
  lead_id?: number
  page?: number
  page_size?: number
  search?: string
}

export interface AnalyticsParams {
  date_from?: string
  date_to?: string
  employee_id?: string
}

export interface AuditLogParams {
  entity_type?: string
  employee_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export interface MeetingSummary {
  id: number
  lead_id: number
  employee_id: string
  employee_name: string | null
  // Deliberately its own shape, not the Customer type used elsewhere — the
  // meetings endpoint returns {id, name, email, phone}, not Customer's
  // {id, name, company, email}.
  customer: {
    id: number
    name: string
    email: string
    phone: string | null
  } | null
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'cancelled' | 'completed'
  meet_link: string | null
}

export interface MeetingListParams {
  page?: number
  page_size?: number
}

// The backend sends each trend as a bare signed delta (e.g. +2, -1, 0) vs
// yesterday, not a {delta, direction} object — direction is derived from the
// sign on the frontend (see TrendBadge in app/dashboard/page.tsx).
export type StatTrend = number

export interface OverviewStats {
  new_leads_today: number
  follow_ups_due: number
  pending_approval: number
  pending_manager_signoff: number
  trends: {
    new_leads_today: StatTrend
    follow_ups_due: StatTrend
    pending_approval: StatTrend
    pending_manager_signoff: StatTrend
  }
}

// Matches the real backend shape (app/api/routes/dashboard.py `recent_activity`) —
// note there is no `id`; `description` is already a complete, human-readable
// sentence; `entity_id` is not always numeric (e.g. employee IDs are strings).
export interface ActivityItem {
  description: string
  entity_type: string
  entity_id: string
  action: string
  actor: string | null
  created_at: string | null
}

// ── Site assessments (proposal-inputs) ───────────────────────────────────────

export type ProposalInputStatus = 'submitted' | 'under_review' | 'approved_for_proposal' | 'rejected'

export interface ProposalInputFile {
  file_ref: string
  target: 'document' | 'installation_photo' | 'staff_signature' | 'customer_signature'
  filename: string
  document_type?: string | null
  photo_slot?: string | null
}

export interface ProposalInputSummary {
  id: number
  lead_id: number
  status: ProposalInputStatus
  customer_type: string
  project_family: string
  state: string
  district: string
  created_at: string | null
}

// Fields beyond the summary mirror this form's own submit shape
// (app/proposal/new/backend-mapping.ts). `gst_number` / `internal_notes` are
// omitted entirely for the Engineer role — always optional here, never
// rendered as an empty label when absent.
export interface ProposalInputDetail extends ProposalInputSummary {
  organisation_name?: string | null
  gst_number?: string | null
  scheme_linked: boolean
  scheme_name: string | null
  pin_code: string
  full_address?: string | null
  discom?: string | null
  consumer_number?: string | null
  site_type: string
  roof_area_sqft?: number | null
  floors?: number | null
  shading_condition?: string | null
  structural_notes?: string | null
  avg_monthly_bill_inr?: number | null
  avg_monthly_units_kwh?: number | null
  peak_load_kw?: number | null
  connection_phase?: string | null
  desired_output_kw?: number | null
  load_notes?: string | null
  connection_type: string
  net_metering_required: boolean
  dcr_panels_required: boolean
  ev_charging: boolean
  battery_storage: boolean
  equipment_tier?: string | null
  additional_requirements?: string | null
  internal_notes?: string | null
  files: ProposalInputFile[]
  lead_fields_filled?: Record<string, unknown>
  rejection_reason?: string | null
}

export interface ProposalInputListParams {
  status?: ProposalInputStatus
  page?: number
  page_size?: number
}

// PATCH /proposal-inputs/{id}/review — verified against the real backend
// source (Prompt 03b). Who: admin and sales (`can_manage_proposal_inputs`).
// Reject reason MUST be sent as `rejection_reason` — a field named `reason`
// is silently ignored by the backend. Setting status back to `submitted` is
// a 422.
export interface ReviewProposalInputInput {
  inputId: number
  status: 'under_review' | 'approved_for_proposal' | 'rejected'
  internalNotes?: string
  rejectionReason?: string
}

// Only present when the review sets status to approved_for_proposal.
export type ProposalDraftOutcome =
  | { triggered: true; proposal_id: number; version: number }
  | { triggered: false; reason: string; missing_fields?: string[] }

// The response is the full serialized site assessment (same shape as
// GET /proposal-inputs/{id}) plus `proposal_draft` on approval — there are
// no top-level draft_proposal_id/missing_fields/draft_error fields.
export interface ReviewProposalInputResponse extends ProposalInputDetail {
  proposal_draft?: ProposalDraftOutcome
}

// GET /proposal-inputs/{id}/files/{file_ref}
export interface ProposalInputFileUrlResponse {
  url: string
  expires_at: string
  filename: string
  file_ref: string
  target: string
}

// GET /api/v1/dashboard/leads/{id} — trimmed for the site-assessment wizard's
// pre-fill (name/phone/email), fetched via a dedicated server route since the
// wizard page has no ClerkProvider for client-side dashboard hooks.
export interface LeadPrefillResponse {
  lead_id: number
  full_name: string | null
  phone: string | null
  email: string | null
}
