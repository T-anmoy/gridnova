'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Employee, Role } from '@/lib/dashboard/types'
import { useAccessMatrix, useSetEmployeeRoles } from '@/lib/access/api'
import { accessErrorMessage } from '@/lib/access/errors'
import { needsSecondApproval, rolesLine } from '@/lib/access/roles'
import { usePermissions } from '@/lib/access/use-permissions'
import { assignableRoles, employeeRoles, rolesProblem, sameRoles } from '@/lib/access/staff-logic'
import { isPendingApproval } from '@/lib/access/types'
import { RolePicker } from './RolePicker'

/** PUT /employees/{id}/roles — the complete new set; 202 when Admin or Accounts moves (§4, §5). */
export function ChangeRolesDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <Dialog open={!!employee} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {employee && <ChangeRolesForm key={employee.id} employee={employee} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ChangeRolesForm({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const before = employeeRoles(employee)
  const [roles, setRoles] = useState<Role[]>(before)
  const [error, setError] = useState<string | null>(null)
  const { canAssignRoles } = usePermissions()
  const matrix = useAccessMatrix()
  const setEmployeeRoles = useSetEmployeeRoles()
  const exclusive = matrix.data?.exclusive_roles ?? []
  const problem = rolesProblem(roles, exclusive)
  const unchanged = sameRoles(before, roles)
  const secondApproval = needsSecondApproval(before, roles)

  async function save() {
    setError(null)
    try {
      const res = await setEmployeeRoles.mutateAsync({ employeeId: employee.id, roles })
      if (isPendingApproval(res)) {
        toast.message('Waiting for a second Admin', { description: res.approval_request.summary })
      } else if (res.unchanged) {
        toast.message(`${employee.name}’s roles are unchanged.`)
      } else {
        toast.success(`${employee.name} now holds ${rolesLine(res.roles, matrix.data)}.`)
      }
      onClose()
    } catch (err) {
      setError(accessErrorMessage(err, 'The roles could not be changed.'))
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change {employee.name}’s roles</DialogTitle>
        <DialogDescription>Now: {rolesLine(before, matrix.data)}. The change applies on their next click — no need for them to sign out.</DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-3">
        <RolePicker options={assignableRoles(matrix.data, canAssignRoles)} selected={roles} exclusive={exclusive} onChange={setRoles} error={problem} legend="New roles" />
        {secondApproval && !unchanged && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="needs-second-approval">
            Giving or removing Admin or Accounts needs a second Admin’s approval. Nothing changes until they approve.
          </p>
        )}
        {error && <p role="alert" data-testid="roles-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
      <DialogFooter className="mt-5 gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void save()} disabled={!!problem || unchanged || setEmployeeRoles.isPending}>
          {setEmployeeRoles.isPending ? 'Saving…' : secondApproval ? 'Ask for approval' : 'Save roles'}
        </Button>
      </DialogFooter>
    </>
  )
}
