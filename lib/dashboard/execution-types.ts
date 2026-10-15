// Staff-audience execution shapes (Phase 4A contract + 0041 follow-ups).
// Money never appears on these screens — execution routes carry none.
import type { ExecutionStatus, StageSubmission } from '@/lib/associate/execution-types'
import type { ProgressStageKey } from '@/lib/associate/onboarding-types'

export interface ExecutionCustomer {
  name: string
  // Engineers get no mobile.
  mobile?: string | null
  project_reference_id: string | null
  site: {
    address: string | null
    pin_code: string | null
    territory: string | null
    latitude: number | null
    longitude: number | null
  }
  associate: {
    associate_id: string
    full_name: string
    associate_type: string
    mobile?: string | null
  } | null
}

export interface StaffExecutionDetail extends ExecutionStatus {
  customer: ExecutionCustomer
  can_verify: boolean
  can_record: boolean
}

export interface ExecutionQueueItem {
  onboarding_id: number
  project_id: number
  project_reference_id: string | null
  customer_name: string
  execution_mode: 'associate' | 'grid_nova'
  current_stage: ProgressStageKey | null
  next_stage: ProgressStageKey | null
  next_stage_label: string | null
  days_in_stage: number | null
  stuck_threshold_days: number | null
  is_stuck: boolean
  pending_submission: { submission_id: number; stage: ProgressStageKey; submitted_at: string } | null
  flags: string[]
  needs_attention: boolean
  attention_reasons: string[]
  started_at: string | null
}

export interface ExecutionQueueParams {
  needs_attention?: boolean
  stuck?: boolean
  stage?: string
  mode?: 'associate' | 'grid_nova'
  page?: number
  page_size?: number
}

export interface PaginatedExecutionQueue {
  items: ExecutionQueueItem[]
  page: number
  page_size: number
  total: number
}

export interface RecordStageInput {
  text: Record<string, string>
  note?: string
  // Admin only, and mandatory on an associate-mode project (0041).
  admin_override_reason?: string
}

export type { StageSubmission }

export interface WorkQueues {
  execution?: { pending_stage_verifications: number; stuck_projects: number; dcr_mismatch: number }
  payments?: {
    awaiting_verification: number
    dishonoured: number
    receipts_held: number
    receipts_without_email: number
    overdue_milestones: number
  }
  // BE-2 §11 — admin and engineer only. `overdue` is counted inside `awaiting` too.
  survey_reviews?: { awaiting: number; overdue: number }
  survey_corrections?: { pending: number }
  // BE-5 — roles that can view execution. `awaiting_handover` is commissioned and not handed over;
  // `packs_incomplete` is the part of those with a manual item (orientation, acknowledgement,
  // O&M contact) still outstanding.
  handover?: { awaiting_handover: number; packs_incomplete: number }
  // BE-5 — `overdue` is the part of `open` that is past its SLA (always 0 while no SLA is set).
  service_requests?: { open: number; overdue: number }
}
