'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarCheck2 } from 'lucide-react'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { RequirePermission } from '@/components/dashboard/RequirePermission'
import { ChangeRolesDialog } from '@/components/dashboard/access/ChangeRolesDialog'
import { DeactivateDialog } from '@/components/dashboard/access/DeactivateDialog'
import { InvitationsList } from '@/components/dashboard/access/InvitationsList'
import { InviteStaffDialog } from '@/components/dashboard/access/InviteStaffDialog'
import { WaitingApprovals } from '@/components/dashboard/access/WaitingApprovals'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/dashboard/utils'
import type { Employee } from '@/lib/dashboard/types'
import { useAccessMatrix, useReactivateStaff, useStaff } from '@/lib/access/api'
import { accessErrorMessage } from '@/lib/access/errors'
import { roleLabel } from '@/lib/access/roles'
import { usePermissions } from '@/lib/access/use-permissions'
import { employeeRoles, withinScope } from '@/lib/access/staff-logic'

// Admin and Network Manager (staff.manage). Every action is limited to people whose roles
// are all ones you may assign (§4 scope rule); the server re-checks each one.
export default function EmployeesPage() {
  return (
    <RequirePermission rule="staff.manage" what="Employees">
      <Employees />
    </RequirePermission>
  )
}

function RoleChips({ employee }: { employee: Employee }) {
  const matrix = useAccessMatrix()
  return (
    <div className="flex flex-wrap gap-1">
      {employeeRoles(employee).map((r) => (
        <Badge key={r} variant="secondary" className="text-xs">{roleLabel(r, matrix.data)}</Badge>
      ))}
    </div>
  )
}

function Employees() {
  const { data, isLoading, error, refetch } = useStaff()
  const { canAssignRoles, employeeId } = usePermissions()
  const reactivate = useReactivateStaff()
  const [changing, setChanging] = useState<Employee | null>(null)
  const [leaving, setLeaving] = useState<Employee | null>(null)

  const staff = data ?? []
  const active = staff.filter((e) => e.is_active)
  const inactive = staff.filter((e) => !e.is_active)
  const inScope = (e: Employee) => withinScope(employeeRoles(e), canAssignRoles)

  async function handleReactivate(e: Employee) {
    try {
      const res = await reactivate.mutateAsync(e.id)
      toast.success(
        res.clerk_unbanned
          ? `${e.name}’s access is back on, with the same roles as before.`
          : `${e.name}’s access is back on in the dashboard, but the sign-in service didn’t confirm${res.clerk_error ? ` (${res.clerk_error})` : ''}.`,
      )
    } catch (err) {
      toast.error(accessErrorMessage(err, 'Access could not be turned back on.'))
    }
  }

  const outOfScopeNote = 'Only an Admin can change someone with these roles.'

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#091c3c]">Employees</h1>
            <p className="mt-1 font-utility text-sm text-[#111827]/65">
              {isLoading ? 'Loading…' : `${active.length} active · ${inactive.length} turned off`}
            </p>
          </div>
          <InviteStaffDialog />
        </div>

        <WaitingApprovals filter={(a) => a.startsWith('staff.')} />

        <InvitationsList />

        <section aria-labelledby="active-heading" className="space-y-3">
          <h2 id="active-heading" className="font-display text-lg font-semibold text-[#091c3c]">Active staff</h2>
          {error ? (
            <DashboardError error={error} onRetry={() => void refetch()} />
          ) : (
            <Card>
              {/* Below md each row stacks into a card, so roles and actions need no sideways scroll. */}
              <Table className="max-md:block">
                <TableHeader className="max-md:hidden">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Calendar</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="max-md:block">
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    : active.map((emp) => {
                        const editable = inScope(emp)
                        const self = emp.id === employeeId
                        return (
                          <TableRow key={emp.id} data-testid={`staff-${emp.id}`} className="max-md:grid max-md:grid-cols-1 max-md:gap-1.5 max-md:px-4 max-md:py-4">
                            <TableCell className="font-utility font-medium text-[#091c3c] max-md:p-0">
                              {emp.name}{self && <span className="ml-1 text-xs font-normal text-[#111827]/60">(you)</span>}
                            </TableCell>
                            <TableCell className="font-utility text-sm text-[#111827]/60 max-md:p-0 max-md:break-all">{emp.email}</TableCell>
                            <TableCell className="max-md:p-0"><RoleChips employee={emp} /></TableCell>
                            <TableCell className="max-md:p-0">
                              {emp.google_calendar_connected ? (
                                <span className="inline-flex items-center gap-1 font-utility text-xs text-green-700"><CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" /> Connected</span>
                              ) : (
                                <span className="font-utility text-xs text-[#111827]/65">Not connected</span>
                              )}
                            </TableCell>
                            <TableCell className="font-utility text-sm text-[#111827]/60 max-md:p-0"><span className="md:hidden">Added </span>{formatDate(emp.created_at)}</TableCell>
                            <TableCell className="text-right max-md:p-0 max-md:pt-1 max-md:text-left">
                              {editable ? (
                                <div className="flex justify-end gap-2 max-md:justify-start">
                                  <Button variant="outline" size="sm" className="max-md:min-h-[44px]" onClick={() => setChanging(emp)}>Change roles</Button>
                                  {!self && (
                                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 max-md:min-h-[44px]" onClick={() => setLeaving(emp)}>Deactivate</Button>
                                  )}
                                </div>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span tabIndex={0} className="text-xs text-[#111827]/60 underline decoration-dotted underline-offset-2" data-testid={`out-of-scope-${emp.id}`}>No changes</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{outOfScopeNote}</TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        {inactive.length > 0 && (
          <section aria-labelledby="inactive-heading" className="space-y-3">
            <h2 id="inactive-heading" className="font-display text-lg font-semibold text-[#091c3c]">Turned off</h2>
            <Card className="divide-y divide-[#e4e8ee]">
              {inactive.map((emp) => (
                <div key={emp.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center" data-testid={`inactive-${emp.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-utility text-sm font-medium text-[#091c3c]">{emp.name} <span className="font-normal text-[#111827]/60">· {emp.email}</span></p>
                    <div className="mt-1"><RoleChips employee={emp} /></div>
                  </div>
                  {inScope(emp) ? (
                    <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => void handleReactivate(emp)} disabled={reactivate.isPending}>Reactivate</Button>
                  ) : (
                    <span className="text-xs text-[#111827]/60">{outOfScopeNote}</span>
                  )}
                </div>
              ))}
            </Card>
          </section>
        )}

        <ChangeRolesDialog employee={changing} onClose={() => setChanging(null)} />
        <DeactivateDialog employee={leaving} onClose={() => setLeaving(null)} />
      </div>
    </TooltipProvider>
  )
}
