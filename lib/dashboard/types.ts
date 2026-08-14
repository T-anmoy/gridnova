export type Role = 'admin' | 'sales' | 'management' | 'engineer'

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
  pipeline_stage: PipelineStage
  lead_score: LeadScore
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
  leads: number
  converted: number
  conversion_rate: number | null // 0..1
}

export interface DealSizeByTier {
  tier: string
  count: number
  avg_deal_size: number | null
  total_deal_size: number | null
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
  week: string // ISO date (week start) or label
  leads_created: number
  proposals_won: number
}

export interface Employee {
  id: string
  name: string
  email: string
  role: Role
  created_at: string | null
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
}

export interface ProposalListParams {
  status?: ProposalStatus
  date_from?: string
  date_to?: string
  lead_id?: number
  page?: number
  page_size?: number
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
