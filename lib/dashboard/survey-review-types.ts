// Staff-side survey review shapes (site_survey.md §8–§11, BE-2 final report §5).
import type { StaffSurveyCorrection, SurveyReviewOutcome, SurveyRevisitItem } from '@/lib/associate/survey-types'

export type { StaffSurveyCorrection, SurveyReviewOutcome, SurveyRevisitItem }

export const REVIEW_OUTCOMES: readonly SurveyReviewOutcome[] = ['feasible', 'feasible_with_conditions', 'revisit_needed', 'not_feasible']

/** POST /dashboard/onboardings/{id}/survey/review (admin, engineer). */
export interface SubmitSurveyReviewInput {
  outcome: SurveyReviewOutcome
  notes?: string
  conditions?: string[]
  revisit_items?: { section: string; field?: string; note: string }[]
}

export type SurveyQueueState = 'awaiting' | 'overdue' | 'reviewed' | 'revised'
export const SURVEY_QUEUE_STATES: readonly SurveyQueueState[] = ['awaiting', 'overdue', 'reviewed', 'revised']

export interface SurveyReviewQueueItem {
  onboarding_id: number
  client_code: string | null
  customer_name: string | null
  associate: { associate_id: string; name: string } | null
  onboarding_status: string
  submitted_at: string | null
  signed_at: string | null
  waiting_since: string | null
  // Whole hours; null unless the survey is awaiting a review.
  hours_waiting: number | null
  overdue: boolean
  revised_after_review: boolean
  review: { outcome: SurveyReviewOutcome | null; reviewed_at: string | null; reviewed_by: string | null }
}

export interface SurveyReviewQueue {
  items: SurveyReviewQueueItem[]
  state: SurveyQueueState
  review_target_hours: number
  page: number
  page_size: number
  total: number
}

export interface SurveyReviewQueueParams {
  state?: SurveyQueueState
  page?: number
  page_size?: number
}

export interface SurveyCorrectionQueueParams {
  status?: 'pending' | 'applied' | 'rejected'
  page?: number
  page_size?: number
}

export interface SurveyCorrectionQueue {
  items: StaffSurveyCorrection[]
  page: number
  page_size: number
  total: number
}

export interface DecideCorrectionResponse {
  correction: StaffSurveyCorrection
  // Apply only.
  flagged_proposal_ids?: number[]
}

export interface GenerateSurveyReportResponse {
  onboarding_id: number
  generated_at: string
  filename: string
}

/** The reason a proposal is flagged for re-verification (§9). */
export interface ReverificationReason {
  fields: string[]
  source: 'correction' | 'revisit' | 'edit' | (string & {})
  correction_id: number | null
  at: string
}

export interface ClearReverificationResponse {
  proposal_id: number
  needs_reverification: false
  reverification_reason: ReverificationReason | null
  reverification_cleared_by: string | null
  reverification_cleared_at: string | null
}

/** 409 `needs_reverification` on staff send / in-person acceptance. */
export interface NeedsReverificationDetail {
  code: 'needs_reverification'
  message: string
  fields?: string[]
}
