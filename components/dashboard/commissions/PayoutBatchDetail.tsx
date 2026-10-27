'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { approvalMode, canDownloadBankFile, payableLines } from '@/lib/commissions/batch-rules'
import { BATCH_STATUS_LABEL, BATCH_STATUS_VARIANT, commissionErrorMessage, formatPeriod } from '@/lib/commissions/labels'
import { formatRate } from '@/lib/commissions/rates'
import { ApiError } from '@/lib/dashboard/api-error'
import { useEmployeeMe } from '@/lib/dashboard/api-client'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { formatInr, isNegativeAmount } from '@/lib/money'
import {
  useApprovePayoutBatch,
  useCancelPayoutBatch,
  useCommissionExport,
  useMarkPayoutPaid,
  usePayoutBatch,
} from '@/lib/commissions/staff-api-client'
import { usePermissions } from '@/lib/access/use-permissions'

function MarkPaid({ batchId, lines, canAct }: { batchId: number; lines: ReturnType<typeof payableLines>; canAct: boolean }) {
  const mark = useMarkPayoutPaid()
  const id = useId()
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canAct) return null

  function review(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const blank = lines.filter((l) => !(refs[l.associate!.associate_id] ?? '').trim()).map((l) => l.associate!.associate_id)
    setMissing(blank)
    if (blank.length > 0) {
      setError('Every line with money to pay needs the bank reference (UTR) of the transfer.')
      document.getElementById(`${id}-${blank[0]}`)?.focus()
      return
    }
    setConfirming(true)
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Mark as paid</CardTitle>
        <p className="text-sm text-gray-500">After the bank transfers are made, enter the bank reference for each line. Lines that net to nothing need none.</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <form onSubmit={review} noValidate className="space-y-3" aria-label="Mark the batch as paid">
          {lines.map((l) => {
            const aid = l.associate!.associate_id
            const invalid = missing.includes(aid)
            return (
              <div key={aid} className="grid items-end gap-2 sm:grid-cols-[1fr_16rem]">
                <div>
                  <p className="text-sm font-medium text-gray-900">{l.associate!.full_name}</p>
                  <p className="text-xs text-gray-500">{aid} · pay {formatInr(l.net)}{l.bank_account_last4 ? ` · account ending ${l.bank_account_last4}` : ''}</p>
                </div>
                <div>
                  <label htmlFor={`${id}-${aid}`} className="mb-1 block text-xs text-gray-500">Bank reference</label>
                  <Input
                    id={`${id}-${aid}`}
                    autoComplete="off"
                    value={refs[aid] ?? ''}
                    onChange={(e) => setRefs((r) => ({ ...r, [aid]: e.target.value }))}
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                    className="h-11 md:h-9"
                  />
                </div>
              </div>
            )
          })}
          <p id={`${id}-err`} role="alert" className={error ? 'text-sm text-red-600' : 'sr-only'}>{error}</p>
          <Button type="submit" className="h-11 md:h-9" disabled={mark.isPending || lines.length === 0}>Review and mark paid…</Button>
          {lines.length === 0 && <p className="text-sm text-gray-500">No line has money to pay in this batch.</p>}
        </form>
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Mark this batch as paid?"
        description="Every earning in the batch becomes Paid and each associate sees the bank reference. This cannot be undone."
        confirmLabel="Mark paid"
        describeError={(err) => {
          const d = err instanceof ApiError ? err.structuredDetail : undefined
          if (Array.isArray(d?.associate_ids)) setMissing(d.associate_ids.map(String))
          return commissionErrorMessage(err)
        }}
        onConfirm={() =>
          mark.mutateAsync({
            batchId,
            lines: lines.map((l) => ({ associate_id: l.associate!.associate_id, bank_reference: (refs[l.associate!.associate_id] ?? '').trim() })),
          })
        }
      />
    </Card>
  )
}

export default function PayoutBatchDetail({ batchId }: { batchId: number }) {
  const { can } = usePermissions()
  const canAct = can('commissions.process')
  const { data: batch, isLoading, error, refetch } = usePayoutBatch(batchId)
  const me = useEmployeeMe()
  const approve = useApprovePayoutBatch()
  const cancel = useCancelPayoutBatch()
  const download = useCommissionExport()
  const [dialog, setDialog] = useState<'approve' | 'override' | 'cancel' | 'bank' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const back = (
    <Link href="/dashboard/commissions/payouts" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#0e2a63]">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Payout batches
    </Link>
  )
  if (error) return <div className="space-y-3">{back}<DashboardError error={error} onRetry={() => void refetch()} /></div>
  if (isLoading || !batch) return <div className="space-y-3">{back}<Skeleton className="h-40 w-full" /></div>

  const mode = approvalMode({ status: batch.status, can, employeeId: me.data?.id, preparedBy: batch.prepared_by })
  const lines = batch.lines ?? []
  const payable = payableLines(lines)
  const showBank = canDownloadBankFile(can, batch.status)

  return (
    <div className="space-y-4">
      {back}
      <Card>
        <CardHeader className="gap-2 p-4 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">Payout batch — {formatPeriod(batch.period)}</CardTitle>
            <Badge variant={BATCH_STATUS_VARIANT[batch.status] ?? 'gray'} data-testid="batch-status">{BATCH_STATUS_LABEL[batch.status] ?? batch.status}</Badge>
          </div>
          <p className="text-xs text-gray-500">Batch #{batch.batch_id} · financial year {batch.financial_year}</p>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-2">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="batch-totals">
            {([['Commission', batch.totals.gross], ['Recoveries', batch.totals.recoveries], ['Carried in', batch.totals.carried_in], ['Taxable', batch.totals.taxable], ['TDS', batch.totals.tds], ['Net to pay', batch.totals.net], ['Still to recover', batch.totals.carry_forward]] as const).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="font-semibold text-[#091c3c]">{formatInr(value)}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-0.5 text-xs text-gray-600">
            <li>Prepared {formatDatetime(batch.prepared_at)}{batch.prepared_by ? ` by ${batch.prepared_by}` : ''}</li>
            {batch.approved_at && <li>Approved {formatDatetime(batch.approved_at)}{batch.approved_by ? ` by ${batch.approved_by}` : ''}</li>}
            {batch.approval_override_reason && <li data-testid="override-reason">Approved by the preparer with an Admin override: “{batch.approval_override_reason}”</li>}
            {batch.paid_at && <li>Paid {formatDatetime(batch.paid_at)}{batch.paid_by ? ` by ${batch.paid_by}` : ''}</li>}
            {batch.cancelled_at && <li>Cancelled {formatDatetime(batch.cancelled_at)}{batch.cancelled_by ? ` by ${batch.cancelled_by}` : ''}{batch.cancel_reason ? ` — ${batch.cancel_reason}` : ''}</li>}
          </ul>
          {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

          <div className="flex flex-wrap items-center gap-3">
            {mode === 'approve' && <Button className="h-11 md:h-9" onClick={() => setDialog('approve')}>Approve batch</Button>}
            {mode === 'override' && <Button className="h-11 md:h-9" variant="outline" onClick={() => setDialog('override')}>Approve as Admin (you prepared it)…</Button>}
            {mode === 'preparer-blocked' && <p className="text-sm text-gray-600" data-testid="preparer-note">You prepared this batch, so a different person has to approve it.</p>}
            {canAct && batch.status === 'draft' && <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('cancel')}>Cancel batch…</Button>}
            {showBank && (
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setDialog('bank')}>
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Bank file (CSV)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Associate</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Recoveries</TableHead>
                <TableHead>Carried in</TableHead>
                <TableHead>TDS</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.line_id ?? l.associate?.associate_id} data-testid="batch-line">
                  <TableCell className="text-sm">
                    <p className="font-medium text-gray-900">{l.associate?.full_name}</p>
                    <p className="text-xs text-gray-500">{l.associate?.associate_id}</p>
                    {l.pan_on_file === false && <Badge variant="orange" className="mt-1" data-testid="no-pan">No PAN on file</Badge>}
                  </TableCell>
                  <TableCell>{formatInr(l.gross)}</TableCell>
                  <TableCell className={isNegativeAmount(l.recoveries) ? 'text-red-700' : undefined}>{formatInr(l.recoveries)}</TableCell>
                  <TableCell>{formatInr(l.carried_in)}</TableCell>
                  <TableCell>
                    {formatInr(l.tds)}
                    {l.tds_rate_percent && <p className="text-xs text-gray-500">at {formatRate(l.tds_rate_percent)}</p>}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatInr(l.net)}
                    {/[1-9]/.test(l.carry_forward) && <p className="text-xs font-normal text-gray-500">{formatInr(l.carry_forward)} still to recover</p>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.account_holder_name}
                    <p className="text-xs text-gray-500">{l.bank_account_last4 ? `…${l.bank_account_last4}` : '—'}{l.bank_ifsc ? ` · ${l.bank_ifsc}` : ''}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.bank_reference ?? '—'}
                    {l.paid_at && <p className="text-xs text-gray-500">{formatDate(l.paid_at)}</p>}
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">No lines.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {batch.status === 'approved' && <MarkPaid batchId={batch.batch_id} lines={payable} canAct={canAct} />}

      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve this payout batch?"
        description="Once approved the batch can be paid. Someone other than the preparer has to do this."
        confirmLabel="Approve"
        describeError={commissionErrorMessage}
        onConfirm={async () => {
          await approve.mutateAsync({ batchId })
          setNotice('Batch approved.')
        }}
      />
      <ReasonDialog
        open={dialog === 'override'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve a batch you prepared"
        description="Normally a different person approves. As an Admin you may approve it yourself with a reason; the override is recorded in the audit log."
        label="Reason for the override"
        required
        confirmLabel="Approve with override"
        describeError={commissionErrorMessage}
        onConfirm={async (reason) => {
          await approve.mutateAsync({ batchId, reason })
          setNotice('Batch approved with an Admin override.')
        }}
      />
      <ReasonDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Cancel this draft batch?"
        description="Its earnings return to the pool and can go into a new batch."
        label="Reason"
        required
        destructive
        confirmLabel="Cancel batch"
        describeError={commissionErrorMessage}
        onConfirm={async (reason) => {
          await cancel.mutateAsync({ batchId, reason })
          setNotice('Batch cancelled.')
        }}
      />
      <ConfirmDialog
        open={dialog === 'bank'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Download the bank file?"
        description={
          <>
            This file contains <strong>full bank account numbers</strong>. Each download is recorded in the audit log. Use it only to upload to the bank, store it nowhere else, and open it as text — a spreadsheet drops leading zeros of account numbers.
          </>
        }
        confirmLabel="Download bank file"
        describeError={commissionErrorMessage}
        onConfirm={() => download({ kind: 'bank', batchId })}
      />
    </div>
  )
}
