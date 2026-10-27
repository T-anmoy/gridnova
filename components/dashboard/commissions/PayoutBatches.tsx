'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { BATCH_STATUS_LABEL, BATCH_STATUS_VARIANT, commissionErrorMessage, formatPeriod } from '@/lib/commissions/labels'
import { ApiError } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { useCommissionExport, useCreatePayoutBatch, usePayoutBatches } from '@/lib/commissions/staff-api-client'
import DateField from '@/components/forms/DateField'
import { usePermissions } from '@/lib/access/use-permissions'

const FY = /^\d{4}-\d{2}$/

function CreateBatch() {
  const create = useCreatePayoutBatch()
  const router = useRouter()
  const id = useId()
  const [period, setPeriod] = useState('')
  const [error, setError] = useState<{ message: string; code?: string; batchId?: number } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}-\d{2}$/.test(period)) {
      setError({ message: 'Choose the month to pay.' })
      document.getElementById(`${id}-period`)?.focus()
      return
    }
    try {
      const batch = await create.mutateAsync(period)
      router.push(`/dashboard/commissions/payouts/${batch.batch_id}`)
    } catch (err) {
      const d = err instanceof ApiError ? err.structuredDetail : undefined
      setError({
        message: commissionErrorMessage(err),
        code: typeof d?.code === 'string' ? d.code : undefined,
        batchId: typeof d?.batch_id === 'number' ? d.batch_id : undefined,
      })
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Prepare a payout batch</CardTitle>
        <p className="text-sm text-gray-500">Takes every approved, rated earning created before the end of the chosen month. The month must have ended, and months are paid in order.</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-wrap items-end gap-3" aria-label="Prepare a payout batch">
          <div>
            <label htmlFor={`${id}-period`} className="mb-1 block text-xs text-gray-500">Month</label>
            <Input
              id={`${id}-period`}
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
              className="h-11 w-48 md:h-9"
            />
          </div>
          <Button type="submit" className="h-11 md:h-9" disabled={create.isPending}>{create.isPending ? 'Preparing…' : 'Prepare batch'}</Button>
        </form>
        <div id={`${id}-err`} role="alert" className={error ? 'mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700' : 'sr-only'} data-testid="batch-error">
          {error && (
            <>
              <p>{error.message}</p>
              {error.code === 'placeholder_rates' && (
                <p className="mt-1"><Link className="font-medium underline" href="/dashboard/commissions/rates">Open rate schedules</Link></p>
              )}
              {error.code === 'draft_batch_exists' && error.batchId != null && (
                <p className="mt-1"><Link className="font-medium underline" href={`/dashboard/commissions/payouts/${error.batchId}`}>Open draft batch #{error.batchId}</Link></p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Exports() {
  const download = useCommissionExport()
  const id = useId()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fy, setFy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmTds, setConfirmTds] = useState(false)

  async function run(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(commissionErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const fyInvalid = fy !== '' && !FY.test(fy)

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Exports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-2" data-testid="commission-exports">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${id}-from`} className="mb-1 block text-xs text-gray-500">From</label>
            <DateField id={`${id}-from`} variant="dashboard" label="From" max={to || undefined} value={from} onChange={setFrom}  />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="mb-1 block text-xs text-gray-500">To</label>
            <DateField id={`${id}-to`} variant="dashboard" label="To" min={from || undefined} value={to} onChange={setTo}  />
          </div>
          <Button variant="outline" className="h-11 md:h-9" disabled={busy} onClick={() => void run(() => download({ kind: 'commissions', date_from: from || undefined, date_to: to || undefined }))}>
            <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Commissions CSV
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${id}-fy`} className="mb-1 block text-xs text-gray-500">Financial year (blank = current)</label>
            <Input id={`${id}-fy`} value={fy} onChange={(e) => setFy(e.target.value)} placeholder="2026-27" inputMode="numeric" aria-invalid={fyInvalid ? true : undefined} aria-describedby={fyInvalid ? `${id}-fy-err` : undefined} className="h-11 w-44 md:h-9" />
          </div>
          <Button variant="outline" className="h-11 md:h-9" disabled={busy || fyInvalid} onClick={() => setConfirmTds(true)}>
            <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> TDS CSV
          </Button>
          {fyInvalid && <p id={`${id}-fy-err`} role="alert" className="w-full text-sm text-red-600">Use a financial year like 2026-27.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </CardContent>
      <ConfirmDialog
        open={confirmTds}
        onOpenChange={setConfirmTds}
        title="Download the TDS file?"
        description="This file contains each associate’s full PAN. Every download is recorded in the audit log. Keep it in Accounts and do not forward it."
        confirmLabel="Download TDS CSV"
        describeError={commissionErrorMessage}
        onConfirm={() => download({ kind: 'tds', financial_year: fy || undefined })}
      />
    </Card>
  )
}

export default function PayoutBatches() {
  const { can } = usePermissions()
  const canAct = can('commissions.process')
  const { data, isLoading, error, refetch } = usePayoutBatches()

  return (
    <div className="space-y-4">
      {canAct && <CreateBatch />}
      {error && <DashboardError error={error} onRetry={() => void refetch()} />}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Associates</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>TDS</TableHead>
                <TableHead>Net to pay</TableHead>
                <TableHead>Prepared</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>}
              {data?.items.map((b) => (
                <TableRow key={b.batch_id} data-testid="batch-row">
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/commissions/payouts/${b.batch_id}`} className="inline-flex min-h-[44px] items-center text-[#0e2a63] underline">{formatPeriod(b.period)}</Link>
                    <p className="text-xs font-normal text-gray-500">FY {b.financial_year} · #{b.batch_id}</p>
                  </TableCell>
                  <TableCell><Badge variant={BATCH_STATUS_VARIANT[b.status] ?? 'gray'}>{BATCH_STATUS_LABEL[b.status] ?? b.status}</Badge></TableCell>
                  <TableCell>{b.line_count ?? '—'}</TableCell>
                  <TableCell>{formatInr(b.totals.gross)}</TableCell>
                  <TableCell>{formatInr(b.totals.tds)}</TableCell>
                  <TableCell className="font-medium">{formatInr(b.totals.net)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(b.prepared_at)}</TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">No payout batches yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {canAct && <Exports />}
    </div>
  )
}
