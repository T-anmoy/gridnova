'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { UNIT_SOURCE_LABEL, handoverErrorMessage } from '@/lib/handover/labels'
import type { Warranty } from '@/lib/handover/schemas'
import { useHandoverPack } from '@/lib/handover/staff-api-client'
import { humanize } from '@/lib/associate/execution-labels'

/** A value Grid Nova has not confirmed is labelled as such — never filled in. */
export function Unconfirmed({ children = 'Not confirmed yet' }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="unconfirmed">
      <Badge variant="orange">Unconfirmed</Badge> <span className="text-gray-600">{children}</span>
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 text-sm sm:grid-cols-[13rem_1fr] sm:gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 text-gray-900">{children}</dd>
    </div>
  )
}

export function WarrantyDetails({ warranty }: { warranty: Warranty }) {
  const sys = warranty.system
  const om = warranty.om
  return (
    <div className="space-y-4" data-testid="warranty-details">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">System warranty and care</CardTitle></CardHeader>
        <CardContent>
          <dl className="divide-y divide-[#e4e8ee]">
            <Row label="Handed over">{formatDate(warranty.handover_date)}</Row>
            <Row label="System warranty">
              {sys.years != null ? `${sys.years} years` : <Unconfirmed />}
              {sys.starts && sys.ends && <span className="block text-xs text-gray-500">{formatDate(sys.starts)} → {formatDate(sys.ends)}</span>}
              {sys.active != null && <Badge variant={sys.active ? 'green' : 'gray'} className="mt-1" data-testid="system-warranty-state">{sys.active ? 'In warranty' : 'Warranty ended'}</Badge>}
            </Row>
            <Row label="Free O&M">
              {om.free_months != null ? `${om.free_months} months` : <Unconfirmed />}
              {om.free_until && <span className="block text-xs text-gray-500">until {formatDate(om.free_until)}{om.free_period_active != null ? (om.free_period_active ? ' (running)' : ' (ended)') : ''}</span>}
            </Row>
            <Row label="O&M after the free period">{om.terms_after_free_period ? om.terms_after_free_period : <Unconfirmed>Not shown until an Admin approves the O&amp;M terms (HW-OM on Launch readiness).</Unconfirmed>}</Row>
            <Row label="Expected panel performance life">
              {warranty.panel_performance_life_years != null ? `${warranty.panel_performance_life_years} years` : <Unconfirmed />}
              <span className="block text-xs text-gray-500">A life span, not a warranty.</span>
            </Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Units</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Make / model</TableHead>
                <TableHead>Serial number</TableHead>
                <TableHead>Warranty</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warranty.units.map((u, i) => (
                <TableRow key={u.unit_id ?? `${u.serial_number}-${i}`} data-testid="warranty-unit">
                  <TableCell className="text-sm capitalize">{humanize(u.category)}</TableCell>
                  <TableCell className="text-sm">{[u.make, u.model].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell className="text-sm font-mono">{u.serial_number ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {u.warranty_end ? (
                      <>
                        {u.warranty_start ? `${formatDate(u.warranty_start)} → ` : 'until '}{formatDate(u.warranty_end)}
                        {u.active != null && <Badge variant={u.active ? 'green' : 'gray'} className="ml-2">{u.active ? 'In warranty' : 'Ended'}</Badge>}
                      </>
                    ) : (
                      <Unconfirmed>No end date</Unconfirmed>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{UNIT_SOURCE_LABEL[u.source] ?? u.source}</TableCell>
                </TableRow>
              ))}
              {warranty.units.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-gray-500">No units are on the serial register.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function WarrantyPanel({ onboardingId }: { onboardingId: number }) {
  const { data: pack, isLoading, error, refetch } = useHandoverPack(onboardingId)
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (error) {
    if (error instanceof ApiError && (error.structuredDetail?.code === 'execution_not_started' || error.status === 404)) {
      return <Card><CardContent className="p-6 text-sm text-gray-600">{handoverErrorMessage(error)}</CardContent></Card>
    }
    return <DashboardError error={error} onRetry={() => void refetch()} />
  }
  if (!pack?.warranty) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-600" data-testid="warranty-pending">
          The warranty register is written when handover is recorded, so there is nothing to show yet.
        </CardContent>
      </Card>
    )
  }
  return <WarrantyDetails warranty={pack.warranty} />
}
