// Shapes copied from the backend contract, not guessed:
// grid-nova-ai-backend docs/api/site_survey.md §8–§11 and the BE-2 final report §5.
import type { StaffSurveyCorrection, SurveyCorrection, SurveyStatus } from '@/lib/associate/survey-types'
import type { SurveyReviewQueue } from '@/lib/dashboard/survey-review-types'
import { SURVEY_STATUS_SIGNED } from './survey-contract'

/** §3 with a §8 revisit review (staff view adds reviewed_by). */
export const STATUS_REVISIT: SurveyStatus = {
  ...SURVEY_STATUS_SIGNED,
  review: {
    outcome: 'revisit_needed',
    notes: 'Terrace area looks too large for the photos.',
    conditions: [],
    revisit_items: [{ section: 'roof_area', field: 'roof_area_sqft', note: 'Measure the terrace again' }],
    reviewed_at: '2026-10-12T07:00:00+00:00',
    revised_after_review: false,
    reviewed_by: 'emp-eng-1',
  },
  report: { generated_at: null },
}

export const STATUS_FEASIBLE: SurveyStatus = {
  ...SURVEY_STATUS_SIGNED,
  review: { outcome: 'feasible', notes: null, conditions: [], revisit_items: [], reviewed_at: '2026-10-12T07:00:00+00:00', revised_after_review: false, reviewed_by: 'emp-eng-1' },
  report: { generated_at: '2026-10-12T08:00:00+00:00' },
}

/** §9 201 body. */
export const CORRECTION_PENDING: SurveyCorrection = {
  correction_id: 4,
  onboarding_id: 12,
  changes: { roof_area_sqft: 950 },
  reason: 'Measured the terrace again',
  status: 'pending',
  requested_at: '2026-10-12T05:01:02+00:00',
  reviewed_at: null,
  review_note: null,
}

export const STAFF_CORRECTION: StaffSurveyCorrection = {
  ...CORRECTION_PENDING,
  requested_by: 'associate:GNA-WB-26-00001',
  reviewed_by: null,
  client_code: 'GNE-WB-RES-2026-00012',
  customer_name: 'Asha Roy',
}

/** §11 */
export const REVIEW_QUEUE: SurveyReviewQueue = {
  items: [
    {
      onboarding_id: 12,
      client_code: 'GNE-WB-RES-2026-00012',
      customer_name: 'Asha Roy',
      associate: { associate_id: 'GNA-WB-26-00001', name: 'Bikash Das' },
      onboarding_status: 'verified',
      submitted_at: '2026-10-10T05:00:00+00:00',
      signed_at: '2026-10-10T05:02:00+00:00',
      waiting_since: '2026-10-10T05:02:00+00:00',
      hours_waiting: 60,
      overdue: true,
      revised_after_review: false,
      review: { outcome: null, reviewed_at: null, reviewed_by: null },
    },
  ],
  state: 'overdue',
  review_target_hours: 48,
  page: 1,
  page_size: 25,
  total: 1,
}

/** §9 re-verification reason on a proposal. */
export const REVERIFICATION_REASON = { fields: ['roof_area_sqft'], source: 'correction', correction_id: 4, at: '2026-10-12T05:03:00+00:00' }
