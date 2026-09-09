export type Role = 'admin' | 'sales' | 'management' | 'engineer' | 'subcontractor'

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
  lead_score: LeadScore
  source: string
  created_at: string
}

export interface LeadDetail {
  lead_id: number
  customer: Customer | null
  pipeline_stage: PipelineStage
  lead_score: LeadScore | null
  collected_fields: Record<string, unknown> | null
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
  pdf_url: string | null
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
  [key: string]: unknown
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
  pdf_url: string | null
  date_created: string | null
  date_sent: string | null
  // Customer accept-link status (populated once the proposal is sent).
  accept_url?: string | null
  accepted_at?: string | null
  customer: Customer | null
  lead: {
    id: number
    pipeline_stage: PipelineStage
    lead_score: LeadScore
  } | null
  versions: ProposalVersion[]
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
  role: Role
  is_active: boolean
  created_at: string | null
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

export interface LeadListParams {
  pipeline_stage?: PipelineStage
  lead_score?: LeadScore
  date_from?: string
  date_to?: string
  search?: string
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
