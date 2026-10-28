'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { PageSkeleton } from '@/components/dashboard/RequirePermission'
import { useStudioOptions, useStudioProposal } from '@/lib/studio/api'
import { isEditableStatus } from '@/lib/studio/logic'
import { ApprovalReview } from './ApprovalReview'
import { ProposalOverview } from './ProposalOverview'
import { StudioWizard } from './StudioWizard'

/**
 * One proposal. A draft (or a version awaiting approval / ready) that this person may edit opens
 * in the wizard; anything else — and ?view=overview or an older ?version= — opens the proposal
 * page with its timeline, actions and versions.
 */
export default function StudioProposalPage({ mode }: { mode: 'auto' | 'review' }) {
  const { id: raw } = useParams<{ id: string }>()
  const sp = useSearchParams()
  const id = Number(raw)
  const version = Number(sp.get('version')) || undefined
  const proposal = useStudioProposal(id, version)
  const options = useStudioOptions()

  if (proposal.error) return <DashboardError error={proposal.error} onRetry={() => void proposal.refetch()} />
  if (!proposal.data || (mode === 'auto' && !options.data)) return <PageSkeleton />
  const view = proposal.data

  if (mode === 'review') return <ApprovalReview view={view} />

  const wizard =
    sp.get('view') !== 'overview' &&
    !version &&
    !!view.can?.edit &&
    isEditableStatus(view.version.status) &&
    view.version.version === view.proposal.current_version
  return wizard ? <StudioWizard view={view} options={options.data!} /> : <ProposalOverview view={view} justIssued={sp.get('issued') === '1'} />
}
