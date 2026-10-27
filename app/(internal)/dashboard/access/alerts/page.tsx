'use client'

import { AlertTriangle } from 'lucide-react'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { AccessTabs } from '@/components/dashboard/access/AccessTabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccessAlerts, useAccessMatrix } from '@/lib/access/api'
import { alertEventLabel, recipientsLine } from '@/lib/access/alerts-view'
import { roleLabel } from '@/lib/access/roles'

// GET /access/alerts — read-only, any staff (access_control.md §6).
export default function AlertRoutingPage() {
  const { data, isLoading, error, refetch } = useAccessAlerts()
  const matrix = useAccessMatrix()
  const events = data?.events ?? []
  const silent = events.filter((e) => !e.reaches_someone)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#091c3c]">Alert routing</h1>
        <p className="mt-1 font-utility text-sm text-[#111827]/65">
          Who receives each staff email: every active person holding one of the listed roles, the lead’s assigned person where marked, and the shared mailboxes already set up. Nobody gets the same email twice, and a turned-off account is never emailed.
        </p>
      </div>
      <AccessTabs />

      {error ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {silent.length > 0 && (
            <p role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="silent-alerts">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {silent.length === 1 ? 'One alert reaches nobody right now' : `${silent.length} alerts reach nobody right now`}: {silent.map((e) => alertEventLabel(e.event)).join(', ')}. Give someone the role, or add a shared mailbox.
            </p>
          )}
          <Card>
            <Table data-testid="alert-routing">
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Who receives it now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.event} data-testid={`alert-${e.event}`}>
                    <TableCell className="font-utility font-medium text-[#091c3c]">{alertEventLabel(e.event)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {e.roles.length === 0 ? (
                          <span className="text-xs text-[#111827]/60">The people who can decide it</span>
                        ) : (
                          e.roles.map((r) => <Badge key={r} variant="secondary" className="text-xs">{roleLabel(r, matrix.data)}</Badge>)
                        )}
                        {e.assigned_employee && <Badge variant="blue" className="text-xs">+ assigned person</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.reaches_someone ? (
                        <span className="text-[#111827]/75">{recipientsLine(e, matrix.data)}</span>
                      ) : (
                        <span className="font-medium text-amber-800">Nobody yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
