import { describe, it, expect } from 'vitest'
import { PORTAL_STEP_ORDER, toPortalSteps, getNextStepKey, isPmSuryaGharProject, orderedStages, isExecutionStage } from '@/lib/onboarding/progress'
import type { FormalProposalBlocked, ProgressResponse, ProgressStage } from '@/lib/associate/onboarding-types'

function stage(over: Partial<ProgressStage>): ProgressStage {
  return {
    stage: 'registered',
    label: 'Registered',
    recorded: false,
    recorded_at: null,
    recorded_by: null,
    evidence: null,
    note: null,
    ...over,
  }
}

const SALES_STAGES = [
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
const FULL_STAGE_ORDER = SALES_STAGES

function progress(over: Partial<ProgressResponse> = {}): ProgressResponse {
  return {
    project_id: 1,
    current_stage: 'verified',
    next_stage: 'site_assessed',
    stages: FULL_STAGE_ORDER.map((s) => stage({ stage: s })),
    ...over,
  }
}

describe('orderedStages (staff timeline)', () => {
  it('returns exactly the stages the backend sent, in the backend order', () => {
    const p = progress({ stages: ['registered', 'feasibility_submitted', 'handover_complete'].map((x) => stage({ stage: x })) })
    expect(orderedStages(p).map((x) => x.stage)).toEqual(['registered', 'feasibility_submitted', 'handover_complete'])
  })
})

describe('toPortalSteps (portal ~6-step tracker)', () => {
  it('returns steps in PORTAL_STEP_ORDER, regardless of the input stage order', () => {
    const shuffled = progress({ stages: [...FULL_STAGE_ORDER].reverse().map((s) => stage({ stage: s })) })
    const steps = toPortalSteps(shuffled)
    expect(steps.map((s) => s.key)).toEqual(PORTAL_STEP_ORDER.slice(0, 7))
  })

  it('collapses proposal_requested + proposal_prepared into one recorded step once EITHER underlying stage is recorded', () => {
    const p = progress({
      stages: FULL_STAGE_ORDER.map((s) =>
        stage({ stage: s, recorded: s === 'registered' || s === 'verified' || s === 'proposal_requested', recorded_at: s === 'proposal_requested' ? '2026-01-01T00:00:00Z' : null })
      ),
    })
    const steps = toPortalSteps(p)
    const formalRequested = steps.find((s) => s.key === 'formal_proposal_requested')!
    expect(formalRequested.recorded).toBe(true)
    expect(formalRequested.recorded_at).toBe('2026-01-01T00:00:00Z')
    // proposal_prepared not recorded — grouping must not require BOTH.
    const proposalReady = steps.find((s) => s.key === 'proposal_ready')!
    expect(proposalReady.recorded).toBe(false)
  })

  it('marks isCurrent on the portal step whose underlying stage matches current_stage', () => {
    const p = progress({ current_stage: 'proposal_prepared' })
    const steps = toPortalSteps(p)
    expect(steps.find((s) => s.key === 'formal_proposal_requested')!.isCurrent).toBe(true)
    expect(steps.filter((s) => s.isCurrent)).toHaveLength(1)
  })
})

describe('isPmSuryaGharProject', () => {
  it('is true only when the backend actually sent portal_agreement_approved', () => {
    expect(isPmSuryaGharProject(progress())).toBe(true)
    expect(isPmSuryaGharProject(progress({ stages: FULL_STAGE_ORDER.filter((s) => s !== 'portal_agreement_approved').map((s) => stage({ stage: s })) }))).toBe(
      false
    )
  })
})

describe('getNextStepKey ("what to do next")', () => {
  it('returns the plain next_stage when nothing is blocked', () => {
    expect(getNextStepKey(progress({ next_stage: 'accepted' }), null)).toBe('accepted')
    expect(getNextStepKey(progress({ next_stage: null }), undefined)).toBe('none')
  })

  it('a blocked formal proposal always wins over next_stage — missing_information', () => {
    const blocked: FormalProposalBlocked = {
      reason: 'missing_information',
      missing_fields: ['customer_email'],
      missing: ['Customer email'],
      draft_error: null,
      draft_failed_at: null,
      requested_at: null,
      requested_by: null,
    }
    expect(getNextStepKey(progress({ next_stage: 'proposal_issued' }), blocked)).toBe('blockedMissingInformation')
  })

  it('a blocked formal proposal always wins over next_stage — draft_failed, and never shares the missing_information key', () => {
    const blocked: FormalProposalBlocked = {
      reason: 'draft_failed',
      missing_fields: [],
      missing: [],
      draft_error: 'timeout',
      draft_failed_at: '2026-01-01T00:00:00Z',
      requested_at: null,
      requested_by: null,
    }
    const key = getNextStepKey(progress({ next_stage: 'proposal_issued' }), blocked)
    expect(key).toBe('blockedDraftFailed')
    expect(key).not.toBe('blockedMissingInformation')
  })
})


const EXEC_ALL = [
  'feasibility_submitted',
  'material_dispatched',
  'installed',
  'inspection_net_meter',
  'commissioned',
  'subsidy_claimed',
  'subsidy_received',
  'handover_complete',
]

describe('execution stages in the portal tracker', () => {
  it('adds installation, commissioning, subsidy and handover steps when the backend sends those stages', () => {
    const p = progress({ stages: [...SALES_STAGES, ...EXEC_ALL].map((x) => stage({ stage: x })), current_stage: 'material_dispatched' })
    const steps = toPortalSteps(p)
    expect(steps.map((x) => x.key)).toEqual(PORTAL_STEP_ORDER)
    expect(steps.find((x) => x.isCurrent)!.key).toBe('installation')
  })

  it('omits the subsidy step when the subsidy stages do not apply (not sent)', () => {
    const applicable = EXEC_ALL.filter((x) => !x.startsWith('subsidy'))
    const steps = toPortalSteps(progress({ stages: [...SALES_STAGES, ...applicable].map((x) => stage({ stage: x })) }))
    expect(steps.map((x) => x.key)).not.toContain('subsidy')
    expect(steps.map((x) => x.key)).toContain('handover')
  })

  it('omits every execution step for a project with no execution stages', () => {
    const steps = toPortalSteps(progress())
    expect(steps.map((x) => x.key)).toEqual(PORTAL_STEP_ORDER.slice(0, 7))
  })

  it('a grouped execution step is recorded once any of its stages is', () => {
    const p = progress({
      stages: [...SALES_STAGES, ...EXEC_ALL].map((x) => stage({ stage: x, recorded: x === 'feasibility_submitted' })),
    })
    expect(toPortalSteps(p).find((x) => x.key === 'installation')!.recorded).toBe(true)
    expect(toPortalSteps(p).find((x) => x.key === 'commissioning')!.recorded).toBe(false)
  })
})

describe('unknown stage fallback', () => {
  it('never throws; an unknown stage joins the group of the stage before it', () => {
    const p = progress({
      stages: [...SALES_STAGES, 'feasibility_submitted', 'site_survey_v2', 'material_dispatched'].map((x) =>
        stage({ stage: x, recorded: x === 'site_survey_v2' })
      ),
      current_stage: 'site_survey_v2',
      next_stage: 'site_survey_v2',
    })
    const steps = toPortalSteps(p)
    expect(steps.find((x) => x.key === 'installation')).toMatchObject({ recorded: true, isCurrent: true })
    expect(getNextStepKey(p, null)).toBe('site_survey_v2')
  })

  it('an unknown first stage is ignored by the portal grouping instead of crashing', () => {
    const p = progress({ stages: [stage({ stage: 'brand_new' }), ...FULL_STAGE_ORDER.map((x) => stage({ stage: x }))], current_stage: 'brand_new' })
    expect(() => toPortalSteps(p)).not.toThrow()
    expect(toPortalSteps(p).some((x) => x.isCurrent)).toBe(false)
  })

  it('isExecutionStage is false for stages it does not know', () => {
    expect(isExecutionStage('installed')).toBe(true)
    expect(isExecutionStage('something_new')).toBe(false)
  })
})

describe('getNextStepKey with execution', () => {
  const exec = (over: Partial<ProgressResponse> = {}) =>
    progress({ stages: [...SALES_STAGES, ...EXEC_ALL].map((x) => stage({ stage: x })), next_stage: 'installed', execution_mode: 'associate', ...over })

  it('uses the execution stage itself in associate mode', () => {
    expect(getNextStepKey(exec(), null)).toBe('installed')
  })
  it('says Grid Nova is handling it in grid_nova mode, but only for execution stages', () => {
    expect(getNextStepKey(exec({ execution_mode: 'grid_nova' }), null)).toBe('executionGridNova')
    expect(getNextStepKey(progress({ execution_mode: 'grid_nova', next_stage: 'accepted' }), null)).toBe('accepted')
  })
  it('pending verification and rejection override the plain next stage', () => {
    expect(getNextStepKey(exec(), null, 'pending')).toBe('executionPending')
    expect(getNextStepKey(exec(), null, 'rejected')).toBe('executionRejected')
  })
  it('a blocked formal proposal still wins over everything', () => {
    const blocked: FormalProposalBlocked = { reason: 'draft_failed', missing_fields: [], missing: [], draft_error: null, draft_failed_at: null, requested_at: null, requested_by: null }
    expect(getNextStepKey(exec(), blocked, 'pending')).toBe('blockedDraftFailed')
  })
})
