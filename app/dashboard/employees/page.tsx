'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { ShieldOff } from 'lucide-react'
import { useEmployees, useUpdateEmployeeRole, useDeactivateEmployee, useReactivateEmployee } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import type { Role, Employee } from '@/lib/dashboard/types'

const ROLES: Role[] = ['admin', 'sales', 'management', 'engineer']

// ApiError.message is a generic "API error 4xx" string — the backend's real
// detail (e.g. the last-admin guard) lives in `.detail` and must be shown
// instead, not swallowed behind the generic message.
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail || err.message
  if (err instanceof Error) return err.message
  return fallback
}

export default function EmployeesPage() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const [pendingChange, setPendingChange] = useState<{ employee: Employee; newRole: Role } | null>(null)
  const [pendingDeactivate, setPendingDeactivate] = useState<Employee | null>(null)

  const { data: employees, isLoading, error, refetch } = useEmployees()
  const updateRole = useUpdateEmployeeRole()
  const deactivate = useDeactivateEmployee()
  const reactivate = useReactivateEmployee()

  // Show access denied for non-admins via conditional render (not router.push)
  if (role && role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldOff className="h-12 w-12 text-[#111827]/20 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold text-[#091c3c]">Access Denied</p>
          <p className="font-utility text-sm text-[#111827]/50 mt-1">Only administrators can manage employees.</p>
        </div>
      </div>
    )
  }

  async function confirmRoleChange() {
    if (!pendingChange) return
    try {
      await updateRole.mutateAsync({ employeeId: pendingChange.employee.id, role: pendingChange.newRole })
      toast.success(`${pendingChange.employee.name}'s role updated to ${pendingChange.newRole}`)
      setPendingChange(null)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update role'))
    }
  }

  async function confirmDeactivate() {
    if (!pendingDeactivate) return
    try {
      await deactivate.mutateAsync(pendingDeactivate.id)
      toast.success(`${pendingDeactivate.name} has been deactivated`)
      setPendingDeactivate(null)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to deactivate employee'))
    }
  }

  async function handleReactivate(employee: Employee) {
    try {
      await reactivate.mutateAsync(employee.id)
      toast.success(`${employee.name} has been reactivated`)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reactivate employee'))
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Employees</h1>
        <p className="font-utility text-sm text-[#111827]/50 mt-1">
          {employees?.length ?? 0} employees
        </p>
      </div>

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : (employees ?? []).map((emp) => (
                    <TableRow key={emp.id} className={emp.is_active ? undefined : 'opacity-50'}>
                      <TableCell className="font-utility font-medium text-[#091c3c]">{emp.name}</TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{emp.email}</TableCell>
                      <TableCell>
                        <Select
                          value={emp.role}
                          onValueChange={(v) => setPendingChange({ employee: emp, newRole: v as Role })}
                          disabled={!emp.is_active}
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? 'green' : 'gray'} className="text-xs">
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(emp.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {emp.is_active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setPendingDeactivate(emp)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleReactivate(emp)}
                            disabled={reactivate.isPending}
                          >
                            Reactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Confirm role change dialog */}
      <Dialog open={!!pendingChange} onOpenChange={(open) => { if (!open) setPendingChange(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change {pendingChange?.employee.name}&apos;s role from{' '}
              <strong>{pendingChange?.employee.role}</strong> to{' '}
              <strong>{pendingChange?.newRole}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingChange(null)}>Cancel</Button>
            <Button onClick={() => void confirmRoleChange()} disabled={updateRole.isPending}>
              {updateRole.isPending ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate dialog */}
      <Dialog open={!!pendingDeactivate} onOpenChange={(open) => { if (!open) setPendingDeactivate(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {pendingDeactivate?.name}?</DialogTitle>
            <DialogDescription>
              This employee will no longer be able to sign in. Their history and past actions remain fully intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeactivate(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDeactivate()} disabled={deactivate.isPending}>
              {deactivate.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
