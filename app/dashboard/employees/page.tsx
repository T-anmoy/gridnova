'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { ShieldOff } from 'lucide-react'
import { useEmployees, useUpdateEmployeeRole } from '@/lib/dashboard/api-client'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/dashboard/utils'
import type { Role, Employee } from '@/lib/dashboard/types'

const ROLES: Role[] = ['admin', 'sales', 'management', 'engineer']

export default function EmployeesPage() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as Role | undefined

  const [pendingChange, setPendingChange] = useState<{ employee: Employee; newRole: Role } | null>(null)

  const { data: employees, isLoading, error, refetch } = useEmployees()
  const updateRole = useUpdateEmployeeRole()

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
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
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
                <TableHead>Date Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : (employees ?? []).map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-utility font-medium text-[#091c3c]">{emp.name}</TableCell>
                      <TableCell className="font-utility text-sm text-[#111827]/60">{emp.email}</TableCell>
                      <TableCell>
                        <Select
                          value={emp.role}
                          onValueChange={(v) => setPendingChange({ employee: emp, newRole: v as Role })}
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
                      <TableCell className="font-utility text-sm text-[#111827]/60">{formatDate(emp.created_at)}</TableCell>
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
    </div>
  )
}
