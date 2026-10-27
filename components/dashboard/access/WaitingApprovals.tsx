'use client'

import { toast } from 'sonner'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { useApprovals, useDecideApproval } from '@/lib/access/api'
import { myPending, waitingForLabel } from '@/lib/access/approvals'
import { accessErrorMessage } from '@/lib/access/errors'
import { usePermissions } from '@/lib/access/use-permissions'
import { DECIDES_APPROVALS } from '@/lib/dashboard/nav'

/**
 * The requester's side of second approval: each change they asked for that is still
 * waiting — "Waiting for a second Admin" — with Withdraw. `filter` narrows the actions shown.
 */
export function WaitingApprovals({ filter }: { filter?: (action: string) => boolean }) {
  const { can, employeeId } = usePermissions()
  const approvals = useApprovals('pending', { enabled: can(DECIDES_APPROVALS) })
  const decide = useDecideApproval()
  const mine = myPending(approvals.data, employeeId).filter((r) => !filter || filter(r.action))
  if (mine.length === 0) return null

  async function withdraw(id: string) {
    try {
      await decide.mutateAsync({ id, decision: 'cancel' })
      toast.success('Request withdrawn.')
    } catch (err) {
      toast.error(accessErrorMessage(err, 'The request could not be withdrawn.'))
    }
  }

  return (
    <ul className="space-y-2" data-testid="waiting-approvals">
      {mine.map((r) => (
        <li key={r.approval_request_id} className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <Clock className="hidden h-5 w-5 shrink-0 text-amber-600 sm:block" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-amber-900">{waitingForLabel(r.action)}</p>
            <p className="text-amber-800">{r.summary}</p>
            <p className="text-xs text-amber-800/80">Asked {formatDatetime(r.created_at)} · expires {formatDate(r.expires_at)}</p>
          </div>
          <Button variant="outline" size="sm" className="min-h-[44px] bg-white sm:min-h-0" onClick={() => void withdraw(r.approval_request_id)} disabled={decide.isPending}>
            Withdraw
          </Button>
        </li>
      ))}
    </ul>
  )
}
