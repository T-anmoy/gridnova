'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Role } from '@/lib/dashboard/types'
import { formatDate } from '@/lib/dashboard/utils'
import { useAccessMatrix, useInviteStaff } from '@/lib/access/api'
import { accessErrorCode, accessErrorMessage } from '@/lib/access/errors'
import { usePermissions } from '@/lib/access/use-permissions'
import { assignableRoles, inviteProblems } from '@/lib/access/staff-logic'
import { isPendingApproval, type PendingApproval, type StaffInvitation } from '@/lib/access/types'
import { RolePicker } from './RolePicker'

type Outcome = { kind: 'sent'; invitation: StaffInvitation } | { kind: 'waiting'; pending: PendingApproval }

/** POST /staff/invitations: name, email and roles; 201 sent, 202 waiting for a second Admin. */
export function InviteStaffDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const { canAssignRoles } = usePermissions()
  const matrix = useAccessMatrix()
  const invite = useInviteStaff()
  const exclusive = matrix.data?.exclusive_roles ?? []
  const options = assignableRoles(matrix.data, canAssignRoles)
  const problems = inviteProblems({ name, email, roles }, exclusive)
  const show = (k: keyof typeof problems) => (submitted ? problems[k] : undefined)

  function reset() {
    setName('')
    setEmail('')
    setRoles([])
    setSubmitted(false)
    setServerError(null)
    setOutcome(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (Object.keys(problems).length) return
    try {
      const res = await invite.mutateAsync({ name: name.trim(), email: email.trim(), roles })
      setOutcome(isPendingApproval(res) ? { kind: 'waiting', pending: res } : { kind: 'sent', invitation: res })
    } catch (err) {
      setServerError(accessErrorMessage(err, 'The invitation could not be sent.'))
      if (accessErrorCode(err) === 'role_not_assignable') void matrix.refetch()
    }
  }

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true) }} className="min-h-[44px] gap-2" data-testid="invite-staff">
        <UserPlus className="h-4 w-4" aria-hidden="true" /> Invite staff
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {outcome ? (
            <div data-testid={`invite-${outcome.kind}`}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {outcome.kind === 'sent' ? <CheckCircle2 className="h-5 w-5 text-green-700" aria-hidden="true" /> : <Clock className="h-5 w-5 text-amber-600" aria-hidden="true" />}
                  {outcome.kind === 'sent' ? 'Invitation sent' : 'Waiting for a second Admin'}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    {outcome.kind === 'sent' ? (
                      <>
                        <p>
                          {outcome.invitation.clerk_status === 'skipped'
                            ? `Invitation saved for ${outcome.invitation.email}, but no email was sent (the sign-in service isn’t set up here).`
                            : `Invitation sent to ${outcome.invitation.email}, expires on ${formatDate(outcome.invitation.expires_at)}.`}
                        </p>
                        <p>They open the link in the email, set up their sign-in, and land on the dashboard with the roles you gave.</p>
                      </>
                    ) : (
                      <>
                        <p>{outcome.pending.approval_request.summary}</p>
                        <p>Admin and Accounts need a second Admin to approve. Nothing is sent until then; the request expires on {formatDate(outcome.pending.approval_request.expires_at)}.</p>
                      </>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={reset}>Invite someone else</Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)} noValidate>
              <DialogHeader>
                <DialogTitle>Invite staff</DialogTitle>
                <DialogDescription>They get an email with a link to set up their sign-in. Access is by invitation only.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="invite-name">Full name</Label>
                  <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!show('name')} className="mt-1" />
                  {show('name') && <p role="alert" className="mt-1 text-sm text-red-600">{show('name')}</p>}
                </div>
                <div>
                  <Label htmlFor="invite-email">Work email</Label>
                  <Input id="invite-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-invalid={!!show('email')} className="mt-1" />
                  {show('email') && <p role="alert" className="mt-1 text-sm text-red-600">{show('email')}</p>}
                </div>
                {matrix.isLoading ? (
                  <p className="text-sm text-[#111827]/60" role="status">Loading roles…</p>
                ) : options.length === 0 ? (
                  <p className="text-sm text-red-600" role="alert">You can’t give any roles. Ask an Admin to invite this person.</p>
                ) : (
                  <RolePicker options={options} selected={roles} exclusive={exclusive} onChange={setRoles} error={show('roles')} />
                )}
                {serverError && <p role="alert" data-testid="invite-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
              </div>
              <DialogFooter className="mt-5 gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={invite.isPending || options.length === 0}>{invite.isPending ? 'Sending…' : 'Send invitation'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
