import { describe, it, expect } from 'vitest'
import { FULL_STAGE_ORDER, PORTAL_STEP_ORDER, toPortalSteps, getNextStepKey, isPmSuryaGharProject } from '@/lib/onboarding/progress'
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

function progress(over: Partial<ProgressResponse> = {}): ProgressResponse {
  return {
    project_id: 1,
    current_stage: 'verified',
    next_stage: 'site_assessed',
    stages: FULL_STAGE_ORDER.map((s) => stage({ stage: s })),
    ...over,
  }
}

describe('FULL_STAGE_ORDER (staff timeline)', () => {
  it('lists every stage the backend can send, in the order they occur', () => {
    expect(FULL_STAGE_ORDER).toEqual([
      'registered',
      'verified',
      'site_assessed',
      'proposal_requested',
      'proposal_prepared',
      'proposal_issued',
      'accepted',
      'agreement_signed',
      'portal_agreement_approved',
    ])
  })
})

describe('toPortalSteps (portal ~6-step tracker)', () => {
  it('always returns steps in PORTAL_STEP_ORDER, regardless of the input stage order', () => {
    const shuffled = progress({ stages: [...FULL_STAGE_ORDER].reverse().map((s) => stage({ stage: s })) })
    const steps = toPortalSteps(shuffled)
    expect(steps.map((s) => s.key)).toEqual(PORTAL_STEP_ORDER)
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
