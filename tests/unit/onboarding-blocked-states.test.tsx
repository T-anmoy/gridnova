import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormalProposalBlockedBadge, FormalProposalBlockedBanner } from '@/components/dashboard/FormalProposalBlocked'
import type { FormalProposalBlocked } from '@/lib/associate/onboarding-types'

const MISSING_INFO: FormalProposalBlocked = {
  reason: 'missing_information',
  missing_fields: ['customer_email'],
  missing: ['Customer email'],
  draft_error: null,
  draft_failed_at: null,
  requested_at: null,
  requested_by: null,
}

const DRAFT_FAILED: FormalProposalBlocked = {
  reason: 'draft_failed',
  missing_fields: [],
  missing: [],
  draft_error: 'PDF renderer timed out',
  draft_failed_at: '2026-01-01T00:00:00Z',
  requested_at: null,
  requested_by: null,
}

describe('formal proposal blocked states — must never share treatment', () => {
  it('badge: missing_information reads as an amber "missing info" indicator, not the draft-failed one', () => {
    render(<FormalProposalBlockedBadge blocked={MISSING_INFO} />)
    expect(screen.getByText('Missing info')).toBeInTheDocument()
    expect(screen.queryByText('Draft failed')).not.toBeInTheDocument()
  })

  it('badge: draft_failed reads as a red "draft failed" indicator, not the missing-info one', () => {
    render(<FormalProposalBlockedBadge blocked={DRAFT_FAILED} />)
    expect(screen.getByText('Draft failed')).toBeInTheDocument()
    expect(screen.queryByText('Missing info')).not.toBeInTheDocument()
  })

  it('banner: missing_information lists the missing items and offers to fix the email, not a retry', () => {
    const onFixEmail = vi.fn()
    render(<FormalProposalBlockedBanner blocked={MISSING_INFO} onFixEmail={onFixEmail} />)
    expect(screen.getByText('Customer email')).toBeInTheDocument()
    expect(screen.getByText('Add the missing email and retry')).toBeInTheDocument()
    expect(screen.queryByText(/draft failed/i)).not.toBeInTheDocument()
  })

  it('banner: draft_failed shows the system-error framing and the failure detail, never the missing-fields list', () => {
    render(<FormalProposalBlockedBanner blocked={DRAFT_FAILED} />)
    expect(screen.getByText('The formal proposal draft failed')).toBeInTheDocument()
    expect(screen.getByText('PDF renderer timed out')).toBeInTheDocument()
    expect(screen.queryByText('Add the missing email and retry')).not.toBeInTheDocument()
  })
})
