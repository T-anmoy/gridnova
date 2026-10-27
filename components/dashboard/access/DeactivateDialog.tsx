'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Employee } from '@/lib/dashboard/types'
import { useAccessMatrix, useDeactivateStaff, useHandover, useReassignLeads, useStaff } from '@/lib/access/api'
import { accessErrorMessage } from '@/lib/access/errors'
import { rolesLine } from '@/lib/access/roles'
import { usePermissions } from '@/lib/access/use-permissions'
import { employeeRoles, leadTakers } from '@/lib/access/staff-logic'
import type { DeactivateResponse, Handover, ReassignResponse } from '@/lib/access/types'

/**
 * Offboarding (§4): confirm → the handover list (open leads, draft proposals, invitations)
 * → pick who takes the leads → done. Access stops on the person's next request; the
 * sign-in service then bans them (every session ends).
 */
export function DeactivateDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <Dialog open={!!employee} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {employee && <DeactivateFlow key={employee.id} employee={employee} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function HandoverList({ h }: { h: Handover }) {
  const empty = h.open_leads.length + h.open_proposals.length + h.pending_invitations.length === 0
  if (empty) return <p className="text-sm text-[#111827]/70" data-testid="handover-empty">Nothing to hand over: no open leads, draft proposals or pending invitations.</p>
  return (
    <ul className="space-y-1.5 text-sm" data-testid="handover-list">
      <li><strong>{h.open_leads.length}</strong> open {h.open_leads.length === 1 ? 'lead' : 'leads'}</li>
      <li>
        <strong>{h.open_proposals.length}</strong> unfinished {h.open_proposals.length === 1 ? 'proposal' : 'proposals'}
        {h.open_proposals.length > 0 && (
          <span className="text-[#111827]/60"> — {h.open_proposals.slice(0, 5).map((p, i) => (
            <span key={p.proposal_id}>{i > 0 && ', '}<Link className="underline" href={`/dashboard/proposals/${p.proposal_id}`}>#{p.proposal_id}</Link></span>
          ))}{h.open_proposals.length > 5 ? '…' : ''} (they move with the leads)</span>
        )}
      </li>
      <li>
        <strong>{h.pending_invitations.length}</strong> pending {h.pending_invitations.length === 1 ? 'invitation' : 'invitations'} they sent
        {h.pending_invitations.length > 0 && <span className="text-[#111827]/60"> — still valid; revoke them under Pending invitations if they should not be used</span>}
      </li>
    </ul>
  )
}

function DeactivateFlow({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { can } = usePermissions()
  const handover = useHandover(employee.id)
  const staff = useStaff()
  const matrix = useAccessMatrix()
  const deactivate = useDeactivateStaff()
  const reassign = useReassignLeads()
  const [takerId, setTakerId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ result: DeactivateResponse; moved: ReassignResponse | null; reassignError: string | null } | null>(null)

  // Moving leads is staff.manage and leads.assign (a Network Manager can't; an Admin or Management can later).
  const canReassign = can('leads.assign')
  const takers = leadTakers(staff.data, matrix.data, employee.id)
  const openLeads = handover.data?.open_leads.length ?? 0

  async function confirm() {
    setError(null)
    let result: DeactivateResponse
    try {
      result = await deactivate.mutateAsync(employee.id)
    } catch (err) {
      setError(accessErrorMessage(err, 'Access could not be turned off.'))
      return
    }
    let moved: ReassignResponse | null = null
    let reassignError: string | null = null
    if (takerId && result.handover.open_leads.length > 0) {
      try {
        moved = await reassign.mutateAsync({ employeeId: employee.id, toEmployeeId: takerId })
      } catch (err) {
        reassignError = accessErrorMessage(err, 'The leads could not be moved.')
      }
    }
    setDone({ result, moved, reassignError })
  }

  async function retryReassign() {
    if (!done || !takerId) return
    try {
      const moved = await reassign.mutateAsync({ employeeId: employee.id, toEmployeeId: takerId })
      setDone({ ...done, moved, reassignError: null })
    } catch (err) {
      setDone({ ...done, reassignError: accessErrorMessage(err, 'The leads could not be moved.') })
    }
  }

  if (done) {
    const takerName = takers.find((t) => t.id === takerId)?.name ?? 'the person you picked'
    return (
      <div data-testid="deactivate-done">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-700" aria-hidden="true" />{employee.name}’s access is turned off</DialogTitle>
          <DialogDescription>They are refused from their next click{done.result.clerk_banned ? ' and every open session has been ended.' : '.'}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2 text-sm">
          {!done.result.clerk_banned && (
            <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900" data-testid="clerk-not-banned">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              The sign-in service didn’t confirm the ban{done.result.clerk_error ? ` (${done.result.clerk_error})` : ''}. The dashboard still refuses them; ask whoever runs Clerk to check the account.
            </p>
          )}
          {done.moved && <p data-testid="leads-moved">{done.moved.moved} {done.moved.moved === 1 ? 'lead' : 'leads'} moved to {takerName}.</p>}
          {done.reassignError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700" role="alert">
              <p>{done.reassignError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void retryReassign()} disabled={reassign.isPending}>Try moving the leads again</Button>
            </div>
          )}
          {!done.moved && !done.reassignError && done.result.handover.open_leads.length > 0 && (
            <p className="text-amber-900">{done.result.handover.open_leads.length} open leads still need a new owner — reassign them from the Leads page.</p>
          )}
          {(done.result.approval_requests_withdrawn?.length ?? 0) > 0 && (
            <p>{done.result.approval_requests_withdrawn!.length} approval {done.result.approval_requests_withdrawn!.length === 1 ? 'request they asked for was' : 'requests they asked for were'} withdrawn.</p>
          )}
        </div>
        <DialogFooter className="mt-5"><Button onClick={onClose}>Done</Button></DialogFooter>
      </div>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Turn off {employee.name}’s access?</DialogTitle>
        <DialogDescription>
          {rolesLine(employeeRoles(employee), matrix.data)} · {employee.email}. Their history and past actions stay. You can turn access back on later.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1.5 font-utility text-sm font-medium text-[#091c3c]">What they leave behind</p>
          {handover.isLoading ? <Skeleton className="h-16 w-full" /> : handover.error ? (
            <p className="text-sm text-red-600" role="alert">{accessErrorMessage(handover.error, 'The handover list could not be loaded.')}</p>
          ) : handover.data ? <HandoverList h={handover.data} /> : null}
        </div>
        {openLeads > 0 && (canReassign ? (
          <div>
            <Label htmlFor="lead-taker">Who takes their open leads?</Label>
            <Select value={takerId} onValueChange={setTakerId}>
              <SelectTrigger id="lead-taker" className="mt-1 min-h-[44px]" data-testid="lead-taker"><SelectValue placeholder="Pick a person (optional)" /></SelectTrigger>
              <SelectContent>
                {takers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {rolesLine(employeeRoles(t), matrix.data)}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-[#111827]/60">Their proposals go with the leads. Leave empty to reassign later from the Leads page.</p>
          </div>
        ) : (
          <p className="text-sm text-[#111827]/70" data-testid="reassign-not-allowed">An Admin or Management will need to move their open leads to someone else.</p>
        ))}
        {error && <p role="alert" data-testid="deactivate-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
      <DialogFooter className="mt-5 gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={() => void confirm()} disabled={deactivate.isPending || reassign.isPending} data-testid="confirm-deactivate">
          {deactivate.isPending ? 'Turning off…' : takerId ? 'Turn off access and move leads' : 'Turn off access'}
        </Button>
      </DialogFooter>
    </>
  )
}
