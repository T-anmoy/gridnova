'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { QueuePager } from '@/components/dashboard/QueuePager'
import NoAccess from '@/components/dashboard/NoAccess'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { useEmployeeMe } from '@/lib/dashboard/api-client'
import { useStaffOnboarding } from '@/lib/dashboard/onboarding-api-client'
import { useDecideSurveyCorrection, useSurveyCorrectionQueue } from '@/lib/dashboard/survey-review-api-client'
import { formatChangeValue, humanize, isSurveyReader, isSurveyReviewer, surveyReviewError } from '@/lib/dashboard/survey-review-ui'
import { STAFF_SURVEY_COPY } from '@/lib/dashboard/staff-copy'
import { formatDatetime } from '@/lib/dashboard/utils'
import type { StaffSurveyCorrection } from '@/lib/associate/survey-types'

const PAGE_SIZE = 25
const STATUSES = ['pending', 'applied', 'rejected'] as const
type Status = (typeof STATUSES)[number]
const STATUS_VARIANT: Record<Status, 'amber' | 'green' | 'red'> = { pending: 'amber', applied: 'green', rejected: 'red' }
const fieldName = (k: string) => (STAFF_SURVEY_COPY.fields as Record<string, string>)[k] ?? humanize(k)

export default function SurveyCorrectionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SurveyCorrections />
    </Suspense>
  )
}

/** Field-by-field: what it is now (pending only, where the role can read it) → what the associate asks for. */
function Diff({ correction, canReadCurrent }: { correction: StaffSurveyCorrection; canReadCurrent: boolean }) {
  const current = useStaffOnboarding(correction.onboarding_id, canReadCurrent && correction.status === 'pending')
  const sa = (current.data?.site_assessment ?? null) as Record<string, unknown> | null
  const showNow = correction.status === 'pending'
  return (
    <ul className="space-y-1.5" data-testid="correction-diff">
      {Object.entries(correction.changes).map(([field, after]) => (
        <li key={field} className="rounded-lg bg-[#f7f9fc] px-3 py-2 text-sm" data-testid={`diff-${field}`}>
          <p className="text-xs font-semibold text-gray-500">{fieldName(field)}</p>
          <p className="flex flex-wrap items-baseline gap-x-2 break-words">
            {showNow && (
              <>
                <span className="text-gray-500 line-through" data-testid="diff-before">
                  {!canReadCurrent ? 'Not shown for your role' : sa ? formatChangeValue(sa[field]) : current.isLoading ? 'Loading…' : 'Unavailable'}
                </span>
                <span aria-hidden="true">→</span>
                <span className="sr-only">changes to</span>
              </>
            )}
            <span className="font-medium text-[#091c3c]" data-testid="diff-after">{formatChangeValue(after)}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

function CorrectionCard({ c, canDecide, myId, canReadCurrent }: { c: StaffSurveyCorrection; canDecide: boolean; myId?: string; canReadCurrent: boolean }) {
  const decide = useDecideSurveyCorrection()
  const [mode, setMode] = useState<'apply' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  // The requester never decides their own request (the server enforces it too).
  const ownRequest = !!myId && c.requested_by === myId
  const showActions = canDecide && c.status === 'pending' && !ownRequest

  async function confirm() {
    if (mode === 'reject' && !note.trim()) {
      setNoteError('A note is required to reject a request.')
      return
    }
    setError(null)
    try {
      const res = await decide.mutateAsync({ id: c.correction_id, decision: mode!, note })
      const flagged = res.flagged_proposal_ids?.length ?? 0
      toast.success(mode === 'apply' ? `Correction applied${flagged ? ` — ${flagged} proposal${flagged === 1 ? '' : 's'} flagged for re-verification` : ''}` : 'Correction rejected')
      setMode(null)
      setNote('')
    } catch (err) {
      setError(surveyReviewError(err))
    }
  }

  return (
    <Card data-testid="correction-card">
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/onboardings/${c.onboarding_id}`} className="font-semibold text-[#0e2a63] underline-offset-2 hover:underline">
            {c.customer_name ?? `Customer ${c.onboarding_id}`}
          </Link>
          <span className="text-xs text-gray-500">{c.client_code ?? ''}</span>
          <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
        </div>
        <p className="text-xs text-gray-500">Requested {formatDatetime(c.requested_at)} by {c.requested_by}</p>
        <Diff correction={c} canReadCurrent={canReadCurrent} />
        <div>
          <p className="text-xs font-semibold text-gray-500">Reason</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{c.reason}</p>
        </div>
        {c.status !== 'pending' && (
          <p className="text-xs text-gray-500">
            {c.status === 'applied' ? 'Applied' : 'Rejected'} {formatDatetime(c.reviewed_at)}{c.reviewed_by ? ` by ${c.reviewed_by}` : ''}
            {c.review_note ? ` — “${c.review_note}”` : ''}
          </p>
        )}
        {c.status === 'pending' && ownRequest && <p className="text-xs text-gray-500">You made this request, so a colleague has to decide it.</p>}
        {showActions && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="min-h-[44px]" onClick={() => { setMode('apply'); setNote(''); setError(null); setNoteError(null) }}>Apply</Button>
            <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => { setMode('reject'); setNote(''); setError(null); setNoteError(null) }}>Reject</Button>
          </div>
        )}
        <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{mode === 'apply' ? 'Apply this correction?' : 'Reject this correction?'}</DialogTitle>
              <DialogDescription>
                {mode === 'apply'
                  ? 'The survey changes, both signatures are cleared, and open proposals that depend on these values are flagged for re-verification.'
                  : 'Nothing on the survey changes. The associate sees your note.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`note-${c.correction_id}`}>{mode === 'reject' ? 'Note (required)' : 'Note (optional)'}</Label>
              <Textarea
                id={`note-${c.correction_id}`}
                value={note}
                rows={3}
                maxLength={2000}
                className="text-base md:text-sm"
                aria-invalid={noteError ? true : undefined}
                aria-describedby={noteError ? `note-err-${c.correction_id}` : undefined}
                onChange={(e) => { setNote(e.target.value); setNoteError(null) }}
              />
              {noteError && <p id={`note-err-${c.correction_id}`} className="text-xs text-red-600">{noteError}</p>}
            </div>
            <div aria-live="polite">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700" data-testid="decide-error">{error}</p>}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
              <Button disabled={decide.isPending} onClick={() => void confirm()}>{decide.isPending ? 'Saving…' : mode === 'apply' ? 'Apply correction' : 'Reject correction'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function SurveyCorrections() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const { role, isLoaded } = useStaffRole()
  const me = useEmployeeMe()
  const raw = sp.get('status')
  const status: Status = (STATUSES as readonly string[]).includes(raw ?? '') ? (raw as Status) : 'pending'
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const { data, isLoading, error, refetch } = useSurveyCorrectionQueue({ status, page, page_size: PAGE_SIZE })

  function go(next: { status?: Status; page?: number }) {
    const q = new URLSearchParams()
    const s = next.status ?? status
    if (s !== 'pending') q.set('status', s)
    if ((next.page ?? 1) > 1) q.set('page', String(next.page))
    const qs = q.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  if (isLoaded && !isSurveyReader(role)) return <NoAccess what="The survey corrections queue" />
  // The engineer role cannot read the customer record, so there is no "current value" for them.
  const canReadCurrent = role === 'admin' || role === 'management' || role === 'sales'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Survey corrections</h1>
        <p className="text-sm text-gray-500">Changes associates ask for on verified customers. An admin or engineer decides each one.</p>
      </div>
      <div role="tablist" aria-label="Correction status" className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={status === s}
            onClick={() => go({ status: s })}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-utility font-medium capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] ${status === s ? 'bg-[#091c3c] text-white' : 'bg-white text-[#091c3c] border border-[#e4e8ee]'}`}
          >
            {s}
          </button>
        ))}
      </div>
      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e4e8ee] bg-white p-8 text-center text-gray-400">Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {data.items.map((c) => (
            <CorrectionCard key={c.correction_id} c={c} canDecide={isSurveyReviewer(role)} myId={me.data?.id} canReadCurrent={canReadCurrent} />
          ))}
        </div>
      )}
      {data && <QueuePager page={data.page} pageSize={data.page_size} total={data.total} onPage={(p) => go({ page: p })} />}
    </div>
  )
}
