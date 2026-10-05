// Single source of shape logic for the onboarding progress bar. Both render
// modes (portal-simplified, staff-full — see components/associate/
// OnboardingProgressPortal.tsx and components/dashboard/
// OnboardingProgressStaff.tsx) derive their steps from the SAME
// GET /{id}/progress response via the helpers below, so they can never
// silently drift apart into two different ideas of "what stage is this at".
//
// The backend owns stage order, labels, applicability and aging: the staff
// view renders `progress.stages` exactly as sent. The only front-end map is
// the portal grouping below, which collapses many stages into a few friendly
// steps — and any stage it doesn't know joins the group of the stage before it,
// so a future backend stage can never crash or vanish from the UI.
import type { FormalProposalBlocked, ProgressAging, ProgressResponse, ProgressStage, ProgressStageKey, ProgressSummary } from '@/lib/associate/onboarding-types'

export type PortalStepKey =
  | 'registered'
  | 'verified'
  | 'site_assessed'
  | 'formal_proposal_requested'
  | 'proposal_ready'
  | 'accepted'
  | 'agreement_signed'
  | 'installation'
  | 'commissioning'
  | 'subsidy'
  | 'handover'

// proposal_requested + proposal_prepared collapse into one visible portal
// step (whichever grouping reads more clearly for a non-technical associate) —
// proposal_issued becomes its own "ready" step.
const PORTAL_GROUPS: Record<PortalStepKey, ProgressStageKey[]> = {
  registered: ['registered'],
  verified: ['verified'],
  site_assessed: ['site_assessed'],
  formal_proposal_requested: ['proposal_requested', 'proposal_prepared'],
  proposal_ready: ['proposal_issued'],
  accepted: ['accepted'],
  agreement_signed: ['agreement_signed', 'portal_agreement_approved'],
  installation: ['feasibility_submitted', 'material_dispatched', 'installed'],
  commissioning: ['inspection_net_meter', 'commissioned'],
  subsidy: ['subsidy_claimed', 'subsidy_received'],
  handover: ['handover_complete'],
}

export const PORTAL_STEP_ORDER: PortalStepKey[] = [
  'registered',
  'verified',
  'site_assessed',
  'formal_proposal_requested',
  'proposal_ready',
  'accepted',
  'agreement_signed',
  'installation',
  'commissioning',
  'subsidy',
  'handover',
]

// The sales-side steps always show (they were the whole tracker before
// execution existed); an execution-side step shows only when the backend sent
// at least one of its stages, so e.g. Subsidy is absent for non-scheme projects.
const ALWAYS_SHOWN = new Set<PortalStepKey>(PORTAL_STEP_ORDER.slice(0, 7))

export const EXECUTION_STAGES: ProgressStageKey[] = [
  ...PORTAL_GROUPS.installation,
  ...PORTAL_GROUPS.commissioning,
  ...PORTAL_GROUPS.subsidy,
  ...PORTAL_GROUPS.handover,
]

export function isExecutionStage(stage: ProgressStageKey | null | undefined): boolean {
  return !!stage && EXECUTION_STAGES.includes(stage)
}

export interface PortalStep {
  key: PortalStepKey
  recorded: boolean
  recorded_at: string | null
  isCurrent: boolean
}

const GROUP_BY_STAGE = new Map<ProgressStageKey, PortalStepKey>(
  PORTAL_STEP_ORDER.flatMap((key) => PORTAL_GROUPS[key].map((stage) => [stage, key] as const))
)

// Group of every stage the backend sent, in the backend's order. An unknown
// stage inherits the group of the stage before it (none, if it is first).
function groupsByStage(stages: ProgressStage[]): Map<ProgressStageKey, PortalStepKey | null> {
  const out = new Map<ProgressStageKey, PortalStepKey | null>()
  let previous: PortalStepKey | null = null
  for (const { stage } of stages) {
    const group: PortalStepKey | null = GROUP_BY_STAGE.get(stage) ?? previous
    out.set(stage, group)
    previous = group
  }
  return out
}

// Collapses the stage list into the portal's visible steps. A grouped step
// counts as recorded once ANY of its underlying stages is recorded (e.g.
// formal_proposal_requested lights up the moment proposal_requested lands,
// not only once proposal_prepared also has).
export function toPortalSteps(progress: ProgressResponse): PortalStep[] {
  const groups = groupsByStage(progress.stages)
  const present = new Set(groups.values())
  const currentGroup = progress.current_stage ? (groups.get(progress.current_stage) ?? GROUP_BY_STAGE.get(progress.current_stage) ?? null) : null
  return PORTAL_STEP_ORDER.filter((key) => ALWAYS_SHOWN.has(key) || present.has(key)).map((key) => {
    const underlying = progress.stages.filter((s) => groups.get(s.stage) === key)
    const recorded = underlying.some((s) => s.recorded)
    const recordedAt = underlying.find((s) => s.recorded)?.recorded_at ?? null
    return { key, recorded, recorded_at: recordedAt, isCurrent: currentGroup === key }
  })
}

/** Stages in the order the backend sent them — never re-sorted or filtered here. */
export function orderedStages(progress: ProgressResponse): ProgressStage[] {
  return progress.stages
}

export function getAging(progress: ProgressResponse): ProgressAging | null {
  return progress.aging ?? null
}

export function isPmSuryaGharProject(progress: ProgressResponse): boolean {
  return progress.stages.some((s) => s.stage === 'portal_agreement_approved')
}

export type NextStepKey =
  | ProgressStageKey
  | 'none'
  | 'blockedMissingInformation'
  | 'blockedDraftFailed'
  | 'executionPending'
  | 'executionRejected'
  | 'executionGridNova'
  | 'blockedFormalProposal'
  | 'blockedPaymentGate'
  | 'blockedDcrMismatch'
  | 'blockedGeneric'

// What the execution status (or progress_summary) says about the latest
// submission for the next stage — /progress itself doesn't carry it.
export type ExecutionState = 'pending' | 'rejected' | null | undefined

// Priority: a blocked formal proposal is the most actionable thing to tell the
// associate (and the two reasons must never share a message); then a stage
// waiting on Grid Nova or sent back; then "Grid Nova is doing this"; otherwise
// the plain next_stage prompt.
export function getNextStepKey(
  progress: ProgressResponse,
  blocked: FormalProposalBlocked | null | undefined,
  executionState?: ExecutionState
): NextStepKey {
  if (blocked?.reason === 'missing_information') return 'blockedMissingInformation'
  if (blocked?.reason === 'draft_failed') return 'blockedDraftFailed'
  if (executionState === 'pending') return 'executionPending'
  if (executionState === 'rejected') return 'executionRejected'
  if (progress.execution_mode === 'grid_nova' && isExecutionStage(progress.next_stage)) return 'executionGridNova'
  return progress.next_stage ?? 'none'
}

const SUMMARY_BLOCKED: Record<string, NextStepKey> = {
  formal_proposal_blocked: 'blockedFormalProposal',
  payment_gate: 'blockedPaymentGate',
  dcr_mismatch: 'blockedDcrMismatch',
}

/**
 * "What to do next" for a customer card, from the list response's own
 * `progress_summary` — no per-card progress request. The detailed formal-proposal
 * block (when the list item carries it) still wins, as everywhere else; then a
 * blocked reason; then a rejected stage; then the plain next stage.
 */
export function nextStepKeyFromSummary(
  summary: ProgressSummary | null | undefined,
  blocked: FormalProposalBlocked | null | undefined
): NextStepKey | null {
  if (blocked?.reason === 'missing_information') return 'blockedMissingInformation'
  if (blocked?.reason === 'draft_failed') return 'blockedDraftFailed'
  if (!summary) return null
  if (summary.blocked) return SUMMARY_BLOCKED[summary.blocked.reason] ?? 'blockedGeneric'
  if (summary.action_kinds.includes('stage_rejected')) return 'executionRejected'
  return summary.next_stage ?? 'none'
}
