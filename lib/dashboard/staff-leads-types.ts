// Response and request shapes for docs/api/staff_contracts.md (BE-6), mirrored
// exactly: a field the contract marks nullable is nullable here. Times are UTC
// ISO 8601 strings.
import type { PipelineStage, Role } from '@/lib/dashboard/types'

export const LEAD_STAGES: readonly PipelineStage[] = [
  'new', 'qualifying', 'qualified', 'proposal_draft', 'proposal_sent', 'negotiation', 'won', 'lost',
]

/** Ordered low < medium < high (§3). Scores are labels, not numbers. */
export const SCORE_ORDER = ['low', 'medium', 'high'] as const
export type ScoreLabel = (typeof SCORE_ORDER)[number]

// §3 filters, as the user has them set (and as they live in the URL).
export interface LeadFilters {
  stages: PipelineStage[]
  minScore: ScoreLabel | ''
  maxScore: ScoreLabel | ''
  /** YYYY-MM-DD, an IST calendar day, inclusive. */
  createdFrom: string
  createdTo: string
}

// §3 structured 422 `{detail: {code, message, field}}`.
export const FILTER_ERROR_CODES = [
  'unknown_stage', 'unknown_score', 'invalid_score_range', 'invalid_date', 'invalid_date_range',
] as const
export type FilterErrorCode = (typeof FILTER_ERROR_CODES)[number]

// §1 schedule-meeting
export interface ScheduleMeetingRequest {
  scheduled_at: string
  duration_minutes?: number
}
export type MeetingStatus = 'scheduled' | 'cancelled' | 'completed'
export interface ScheduleMeetingResponse {
  meeting_id: number
  lead_id: number
  employee_id: string
  scheduled_at: string
  duration_minutes: number
  meet_link: string | null
  status: MeetingStatus
}

// §1 customer memory
export interface MemoryCustomer {
  customer_id: number
  name: string
  email: string
  company: string | null
}
export interface MemoryProfile {
  summary: string
  traits: string[]
  open_questions: string[]
  agent_notes: string | null
  next_best_action: string | null
  last_reflected_at: string
  reflection_count: number
}
export interface MemoryItem {
  id: number
  kind: string
  source: string
  summary: string
  detail: string | null
  tags: string[]
  salience: number
  lead_id: number | null
  occurred_at: string
  created_by: string
}
export interface CustomerMemoryResponse {
  customer: MemoryCustomer
  profile: MemoryProfile | null
  memory_count: number
  memories: MemoryItem[]
}

// §1 memory ask
export interface MemoryAskRequest {
  question: string
  customer_id?: number
}
export interface MemoryCitation {
  id: number
  kind: string
  summary: string
  occurred_at: string
}
export interface MemoryAskResponse {
  answer: string
  resolved: boolean
  customer_id: number | null
  candidates: MemoryCustomer[]
  citations: MemoryCitation[]
  retrieval_mode: string | null
}

// §1 reflect
export interface ReflectResponse {
  trigger: string
  lead_id: number
  memories_written: number
  skipped: string | null
}

// §2 lead detail: non-Engineer vs Engineer shape. Fields of the full shape
// that the existing LeadDetail type already carries are reused there.
export interface EngineerLeadDetail {
  // Never present: its absence is how the shape is told apart from LeadDetail
  // (declared so the type guard can narrow the full shape instead of `never`).
  customer?: undefined
  lead_id: number
  pipeline_stage: PipelineStage
  collected_fields: Record<string, unknown> | null
}

export type StaffRole = Role
