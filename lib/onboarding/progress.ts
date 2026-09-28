// Single source of shape logic for the onboarding progress bar. Both render
// modes (portal-simplified, staff-full — see components/associate/
// OnboardingProgressPortal.tsx and components/dashboard/
// OnboardingProgressStaff.tsx) derive their steps from the SAME
// GET /{id}/progress response via the helpers below, so they can never
// silently drift apart into two different ideas of "what stage is this at".
import type { FormalProposalBlocked, ProgressResponse, ProgressStage, ProgressStageKey } from '@/lib/associate/onboarding-types'

export const FULL_STAGE_ORDER: ProgressStageKey[] = [
  'registered',
  'verified',
  'site_assessed',
  'proposal_requested',
  'proposal_prepared',
  'proposal_issued',
  'accepted',
  'agreement_signed',
  'portal_agreement_approved',
]

export type PortalStepKey =
  | 'registered'
  | 'verified'
  | 'site_assessed'
  | 'formal_proposal_requested'
  | 'proposal_ready'
  | 'accepted'
  | 'agreement_signed'

// proposal_requested + proposal_prepared collapse into one visible portal
// step (per the brief: whichever grouping reads more clearly for a
// non-technical associate) — proposal_issued becomes its own "ready" step.
const PORTAL_GROUPS: Record<PortalStepKey, ProgressStageKey[]> = {
  registered: ['registered'],
  verified: ['verified'],
  site_assessed: ['site_assessed'],
  formal_proposal_requested: ['proposal_requested', 'proposal_prepared'],
  proposal_ready: ['proposal_issued'],
  accepted: ['accepted'],
  agreement_signed: ['agreement_signed'],
}

export const PORTAL_STEP_ORDER: PortalStepKey[] = [
  'registered',
  'verified',
  'site_assessed',
  'formal_proposal_requested',
  'proposal_ready',
  'accepted',
  'agreement_signed',
]

export interface PortalStep {
  key: PortalStepKey
  recorded: boolean
  recorded_at: string | null
  isCurrent: boolean
}

function byStage(stages: ProgressStage[]): Map<ProgressStageKey, ProgressStage> {
  return new Map(stages.map((s) => [s.stage, s]))
}

// Collapses the full stage list into the portal's ~6 visible steps. A
// grouped step counts as recorded once ANY of its underlying stages is
// recorded (e.g. formal_proposal_requested lights up the moment
// proposal_requested lands, not only once proposal_prepared also has).
export function toPortalSteps(progress: ProgressResponse): PortalStep[] {
  const map = byStage(progress.stages)
  return PORTAL_STEP_ORDER.map((key) => {
    const underlying = PORTAL_GROUPS[key].map((s) => map.get(s)).filter((s): s is ProgressStage => !!s)
    const recorded = underlying.some((s) => s.recorded)
    const recordedAt = underlying.find((s) => s.recorded)?.recorded_at ?? null
    const isCurrent = underlying.some((s) => s.stage === progress.current_stage)
    return { key, recorded, recorded_at: recordedAt, isCurrent }
  })
}

export function isPmSuryaGharProject(progress: ProgressResponse): boolean {
  return progress.stages.some((s) => s.stage === 'portal_agreement_approved')
}

export type NextStepKey =
  | ProgressStageKey
  | 'none'
  | 'blockedMissingInformation'
  | 'blockedDraftFailed'

// A blocked formal-proposal state always takes priority over the plain
// next_stage prompt — it's the more actionable, more urgent thing to tell
// the associate about, and the two reasons must never share a message (see
// the Phase 3B brief's requirement that missing_information and
// draft_failed get genuinely different treatment everywhere this appears).
export function getNextStepKey(progress: ProgressResponse, blocked: FormalProposalBlocked | null | undefined): NextStepKey {
  if (blocked?.reason === 'missing_information') return 'blockedMissingInformation'
  if (blocked?.reason === 'draft_failed') return 'blockedDraftFailed'
  return progress.next_stage ?? 'none'
}
