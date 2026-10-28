'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { studioApi, studioKeys, useStudioToken, useVersionDiff } from '@/lib/studio/api'
import { APPROVAL_REASON_LABEL, diffValue, fieldLabel, groupChecks, lastIssuedBefore, studioError } from '@/lib/studio/logic'
import type { StudioView } from '@/lib/studio/types'
import { FiguresSummary } from './FiguresSummary'
import { StudioPreview } from './StudioPreview'
import { INPUT, Money, Notice, Panel, StatusChip } from './ui'

// The approver's screen for a Studio proposal (studio.approve): the PDF, the figures, the
// discount and its reason, what changed since the last issued version, then Approve or send
// back with a comment. The server refuses the person who prepared the version (maker–checker).

export function ApprovalReview({ view }: { view: StudioView }) {
  const router = useRouter()
  const qc = useQueryClient()
  const token = useStudioToken()
  const id = view.proposal.id
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prev = lastIssuedBefore(view.versions, view.version.version)
  const diff = useVersionDiff(id, prev, prev ? view.version.version : null)
  const pending = view.version.status === 'pending_approval'
  const canDecide = !!view.can?.approve
  const checks = groupChecks(view)
  const price = view.document.price

  async function decide(kind: 'approve' | 'reject') {
    setBusy(kind)
    setError(null)
    try {
      const v = kind === 'approve' ? await studioApi.approve(token, id, comment.trim() || null) : await studioApi.reject(token, id, comment.trim())
      qc.setQueryData(studioKeys.proposal(id), v)
      void qc.invalidateQueries({ queryKey: ['studio', 'proposals'] })
      void qc.invalidateQueries({ queryKey: ['studio', 'summary'] })
      toast.success(kind === 'approve' ? 'Approved. The preparer can issue it now.' : 'Sent back to the preparer with your comment.')
      router.push('/dashboard/studio')
    } catch (e) {
      setError(studioError(e).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-utility text-xs text-[#111827]/60">
          <Link href="/dashboard/studio" className="hover:underline">Studio Home</Link> / Approval
        </p>
        <h1 className="mt-0.5 font-display text-xl font-bold text-[#091c3c] md:text-2xl">Review: {view.proposal.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-utility text-sm text-[#111827]/70">
          <StatusChip status={view.version.status} />
          <span>{view.proposal.code} · version {view.version.version}</span>
          <span>· Total <Money value={view.figures.total} /></span>
        </div>
      </div>

      {!pending && <Notice tone="info">This version is not waiting for approval any more.</Notice>}
      {pending && !canDecide && (
        <Notice tone="warn" testId="maker-checker">You prepared or changed this version, so someone else must approve it. Ask another Admin or Management.</Notice>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Why it needs approval">
            <ul className="list-disc space-y-1 pl-5 font-utility text-sm" data-testid="approval-reasons">
              {view.approval_reasons.map((r) => (
                <li key={r}>{APPROVAL_REASON_LABEL[r] ?? r}</li>
              ))}
            </ul>
            {view.figures.below_price_master && (
              <p className="mt-2 font-utility text-sm text-amber-900">
                Price master basic <Money value={view.figures.below_price_master.list_basic} />, offered <Money value={view.figures.below_price_master.basic} /> — {view.figures.below_price_master.percent}% below.
              </p>
            )}
            {view.figures.discount && (
              <p className="mt-2 font-utility text-sm" data-testid="review-discount">
                Discount <Money value={view.figures.discount.amount} /> — “{view.figures.discount.reason}”
              </p>
            )}
            {price.reason && <p className="mt-2 font-utility text-sm" data-testid="review-reason">Reason given: “{price.reason}”</p>}
            {checks.warnings.length > 0 && (
              <p className="mt-2 font-utility text-xs text-[#111827]/60">{checks.warnings.length} warning{checks.warnings.length === 1 ? '' : 's'} checked by the preparer: {checks.warnings.map((w) => w.message).join(' · ')}</p>
            )}
          </Panel>

          <FiguresSummary figures={view.figures} />

          {prev && (
            <Panel title={`Changed since version ${prev} (issued)`}>
              {diff.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (diff.data?.changes ?? []).length === 0 ? (
                <p className="font-utility text-sm text-[#111827]/60">No differences.</p>
              ) : (
                <ul className="space-y-1 font-utility text-sm" data-testid="review-diff">
                  {diff.data!.changes.map((c) => (
                    <li key={c.field}>
                      <span className="text-[#111827]/65">{fieldLabel(c.field)}:</span> <span className="text-red-800 line-through">{diffValue(c.before)}</span> → <span className="text-green-800">{diffValue(c.after)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {pending && canDecide && (
            <Panel title="Your decision">
              <label htmlFor="decision-comment" className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">Comment</label>
              <textarea id="decision-comment" className={INPUT} rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
              <p className="mt-1 font-utility text-xs text-[#111827]/60">Optional when approving. Needed when sending it back — say what to change.</p>
              {error && <Notice tone="error" className="mt-2">{error}</Notice>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className="min-h-11" disabled={!!busy} onClick={() => void decide('approve')} data-testid="approve">
                  {busy === 'approve' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Approve
                </Button>
                <Button type="button" variant="outline" className="min-h-11" disabled={!!busy || comment.trim().length < 3} onClick={() => void decide('reject')} data-testid="reject">
                  {busy === 'reject' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1.5 h-4 w-4" />} Send back
                </Button>
              </div>
            </Panel>
          )}
        </div>
        <StudioPreview proposalId={id} refreshKey={view.revision} />
      </div>
    </div>
  )
}
