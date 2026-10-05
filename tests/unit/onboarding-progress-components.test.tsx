import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OnboardingProgressStaff from '@/components/dashboard/OnboardingProgressStaff'
import OnboardingProgressPortal from '@/components/associate/OnboardingProgressPortal'
import { en } from './helpers/i18n'
import type { ProgressResponse, ProgressStage } from '@/lib/associate/onboarding-types'

const st = (stage: string, label: string, over: Partial<ProgressStage> = {}): ProgressStage => ({
  stage,
  label,
  recorded: false,
  recorded_at: null,
  recorded_by: null,
  evidence: null,
  note: null,
  ...over,
})

const progress: ProgressResponse = {
  project_id: 1,
  current_stage: 'material_dispatched',
  next_stage: 'material_dispatched',
  stages: [
    st('registered', 'Registered', { recorded: true }),
    st('agreement_signed', 'Agreement signed', { recorded: true, evidence: { via: 'direct' } }),
    st('feasibility_submitted', 'Feasibility submitted', { recorded: true, evidence: { via: 'admin_override' } }),
    st('material_dispatched', 'Material dispatched'),
    st('handover_complete', 'Handover complete'),
  ],
  not_applicable: [{ stage: 'subsidy_claimed', label: 'Subsidy claimed' }],
  execution_mode: 'associate',
  aging: { days_in_stage: 20, stuck_threshold_days: 14, is_stuck: true },
}

describe('OnboardingProgressStaff', () => {
  it('shows every stage the backend sent, including execution stages, in its order', () => {
    render(<OnboardingProgressStaff progress={progress} />)
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(items[0]).toContain('Registered')
    expect(items[2]).toContain('Feasibility submitted')
    expect(items[3]).toContain('Material dispatched')
    expect(items[4]).toContain('Handover complete')
    expect(items[2]).toContain('admin_override')
  })

  it('marks a stuck stage with days in stage and a Stuck badge, and shows the mode and n/a stages', () => {
    render(<OnboardingProgressStaff progress={progress} />)
    expect(screen.getByTestId('stuck-marker')).toBeInTheDocument()
    expect(screen.getByTestId('stage-aging')).toHaveTextContent('20 days in this stage — stuck (usually 14 days)')
    expect(screen.getByTestId('execution-mode')).toHaveTextContent('Associate executes')
    expect(screen.getByTestId('not-applicable')).toHaveTextContent('Subsidy claimed')
  })

  it('shows no stuck marker when the project is not stuck', () => {
    render(<OnboardingProgressStaff progress={{ ...progress, aging: { days_in_stage: 2, stuck_threshold_days: 14, is_stuck: false } }} />)
    expect(screen.queryByTestId('stuck-marker')).toBeNull()
    expect(screen.getByTestId('stage-aging')).toHaveTextContent('2 days in this stage')
  })
})

describe('OnboardingProgressPortal', () => {
  it('renders the execution steps (labelled in the portal copy) only when they apply', () => {
    render(<OnboardingProgressPortal progress={progress} copy={en.associates.portal.shared.progress} />)
    expect(screen.getByText('Installation')).toBeInTheDocument()
    expect(screen.getByText('Handover')).toBeInTheDocument()
    expect(screen.queryByText('Subsidy')).toBeNull()
  })
})
