'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { WaitingApprovals } from '@/components/dashboard/access/WaitingApprovals'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { DECIDES_APPROVALS } from '@/lib/dashboard/nav'
import { useApprovals, useDecideApproval, useStaff } from '@/lib/access/api'
import { approvalActionLabel, decidable } from '@/lib/access/approvals'
import { accessErrorMessage } from '@/lib/access/errors'
import { usePermissions } from '@/lib/access/use-permissions'
import type { ApprovalRequest } from '@/lib/access/types'

// Second approval (maker–checker, access_control.md §5): requests someone else asked for,
// with approve / reject for people who may decide them; your own requests wait.
export default function ApprovalsPage() {
  return (
    <RequirePermission rule={DECIDES_APPROVALS} what="Approvals">
      <Approvals />
    </RequirePermission>
  )
}

function Approvals() {
  const { employeeId, can, canAssignRoles } = usePermissions()
  const { data, isLoading, error, refetch } = useApprovals('pending')
  // BE-19 names the requester on every item; the staff list (staff.manage) covers an older backend.
  const staff = useStaff({ enabled: can('staff.manage') })
  const names = new Map((staff.data ?? []).map((e) => [e.id, e.name]))
  const who = (r: ApprovalRequest) =>
    r.requested_by === employeeId ? 'You' : (r.requested_by_name ?? names.get(r.requested_by) ?? 'someone whose name is not known')
  const [deciding, setDeciding] = useState<{ request: ApprovalRequest; decision: 'approve' | 'reject' } | null>(null)
  const inbox = decidable(data, employeeId, canAssignRoles)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Approvals</h1>
        <p className="mt-1 font-utility text-sm text-[#111827]/65">
          Changes that need a second person: giving or removing Admin or Accounts, and — when switched on — commission rates and payout batches.
        </p>
      </div>

      <WaitingApprovals />

      <section aria-labelledby="inbox-heading" className="space-y-3">
        <h2 id="inbox-heading" className="font-display text-lg font-semibold text-[#091c3c]">Waiting for your decision</h2>
        {error ? (
          <DashboardError error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : inbox.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-[#e4e8ee] bg-white p-5 text-sm text-[#111827]/70" data-testid="approvals-empty">
            <CheckCircle2 className="h-5 w-5 text-green-700" aria-hidden="true" /> Nothing waiting for a second approval.
          </div>
        ) : (
          <Card className="divide-y divide-[#e4e8ee]">
            {inbox.map((r) => (
              <div key={r.approval_request_id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center" data-testid={`approval-${r.approval_request_id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="amber" className="text-xs">{approvalActionLabel(r.action)}</Badge>
                    <span className="text-xs text-[#111827]/60">Expires {formatDate(r.expires_at)}</span>
                  </div>
                  <p className="mt-1 font-utility text-sm font-medium text-[#091c3c]">{r.summary}</p>
                  <p className="text-xs text-[#111827]/60">Asked by {who(r)} · {formatDatetime(r.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="min-h-[44px] md:min-h-0" onClick={() => setDeciding({ request: r, decision: 'approve' })}>Approve</Button>
                  <Button size="sm" variant="outline" className="min-h-[44px] md:min-h-0" onClick={() => setDeciding({ request: r, decision: 'reject' })}>Reject</Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <DecideDialog value={deciding} onClose={() => setDeciding(null)} />
    </div>
  )
}

function DecideDialog({ value, onClose }: { value: { request: ApprovalRequest; decision: 'approve' | 'reject' } | null; onClose: () => void }) {
  const decide = useDecideApproval()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const approve = value?.decision === 'approve'

  async function submit() {
    if (!value) return
    setError(null)
    try {
      await decide.mutateAsync({ id: value.request.approval_request_id, decision: value.decision, note: note.trim() || undefined })
      toast.success(approve ? 'Approved — the change has been applied.' : 'Rejected — nothing was changed.')
      setNote('')
      onClose()
    } catch (err) {
      setError(accessErrorMessage(err, 'The decision could not be saved.'))
    }
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => { if (!o) { setNote(''); setError(null); onClose() } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{approve ? 'Approve this change?' : 'Reject this change?'}</DialogTitle>
          <DialogDescription>{value?.request.summary}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decision-note">Note {approve ? '(optional)' : '(optional, shown to the person who asked)'}</Label>
          <Textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} />
          {approve && <p className="text-xs text-[#111827]/60">The change is checked again with your permissions when you approve.</p>}
          {error && <p role="alert" data-testid="decision-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={approve ? 'default' : 'destructive'} onClick={() => void submit()} disabled={decide.isPending}>
            {decide.isPending ? 'Saving…' : approve ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
