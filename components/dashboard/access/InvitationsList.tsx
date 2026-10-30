'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ManualSignUpNote } from '@/components/dashboard/access/ManualSignUpNote'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { formatDate } from '@/lib/dashboard/utils'
import { useResendInvitation, useRevokeInvitation, useStaffInvitations } from '@/lib/access/api'
import { accessErrorMessage } from '@/lib/access/errors'
import { roleLabel } from '@/lib/access/roles'
import { usePermissions } from '@/lib/access/use-permissions'
import { openInvitations, withinScope } from '@/lib/access/staff-logic'
import type { StaffInvitation } from '@/lib/access/types'

/** Pending (and lapsed) invitations: resend, revoke, expiry date (§3). */
export function InvitationsList() {
  const { data, isLoading, error, refetch } = useStaffInvitations()
  const resend = useResendInvitation()
  const revoke = useRevokeInvitation()
  const { canAssignRoles } = usePermissions()
  const [revoking, setRevoking] = useState<StaffInvitation | null>(null)
  const items = openInvitations(data)

  async function handleResend(inv: StaffInvitation) {
    try {
      const next = await resend.mutateAsync(inv.invitation_id)
      toast.success(`Invitation sent again to ${inv.email}, expires on ${formatDate(next.expires_at)}.`)
    } catch (err) {
      toast.error(accessErrorMessage(err, 'The invitation could not be sent again.'))
    }
  }

  async function confirmRevoke() {
    if (!revoking) return
    try {
      const res = await revoke.mutateAsync(revoking.invitation_id)
      toast.success(
        res.clerk_error
          ? `Invitation to ${revoking.email} withdrawn. The email link may still open, but sign-in will be refused.`
          : `Invitation to ${revoking.email} withdrawn.`,
      )
      setRevoking(null)
    } catch (err) {
      toast.error(accessErrorMessage(err, 'The invitation could not be withdrawn.'))
    }
  }

  return (
    <section aria-labelledby="invitations-heading" className="space-y-3">
      <h2 id="invitations-heading" className="font-display text-lg font-semibold text-[#091c3c]">Pending invitations</h2>
      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-[#111827]/60" data-testid="no-invitations">No invitations waiting.</p>
      ) : (
        <Card className="divide-y divide-[#e4e8ee]">
          {items.map((inv) => {
            const mine = withinScope(inv.roles, canAssignRoles)
            return (
              <div key={inv.invitation_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" data-testid={`invitation-${inv.invitation_id}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-utility text-sm font-medium text-[#091c3c]">
                    {inv.name} <span className="font-normal text-[#111827]/60">· {inv.email}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {inv.roles.map((r) => <Badge key={r} variant="secondary" className="text-xs">{roleLabel(r)}</Badge>)}
                    {inv.status === 'expired' ? (
                      <Badge variant="red" className="text-xs">Expired {formatDate(inv.expires_at)}</Badge>
                    ) : (
                      <span className="text-xs text-[#111827]/60">Expires {formatDate(inv.expires_at)}</span>
                    )}
                    {inv.delivery === 'manual' && <span className="text-xs text-amber-800">Email not sent</span>}
                  </div>
                  {inv.manual_instructions && (
                    <div className="mt-2"><ManualSignUpNote instructions={inv.manual_instructions} testId={`manual-sign-up-${inv.invitation_id}`} /></div>
                  )}
                </div>
                {mine && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" disabled={resend.isPending} onClick={() => void handleResend(inv)}>Resend</Button>
                    <Button variant="outline" size="sm" className="min-h-[44px] text-red-600 hover:text-red-700 sm:min-h-0" onClick={() => setRevoking(inv)}>Revoke</Button>
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}
      <Dialog open={!!revoking} onOpenChange={(o) => { if (!o) setRevoking(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw the invitation to {revoking?.name}?</DialogTitle>
            <DialogDescription>The link in their email stops working. You can invite them again later.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevoking(null)}>Keep it</Button>
            <Button variant="destructive" onClick={() => void confirmRevoke()} disabled={revoke.isPending}>{revoke.isPending ? 'Withdrawing…' : 'Withdraw invitation'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
