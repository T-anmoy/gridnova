'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import { DashboardError } from '@/components/dashboard/DashboardError'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { QueuePager } from '@/components/dashboard/QueuePager'
import SelectField from '@/components/dashboard/SelectField'
import { useApproveCommissions, useReverseCommission, useStaffCommissions } from '@/lib/commissions/staff-api-client'
import {
  EARNING_ROLE_LABEL,
  ENTRY_KIND_LABEL,
  ENTRY_STATUS_LABEL,
  ENTRY_STATUS_VARIANT,
  PENDING_REASON_LABEL,
  commissionErrorMessage,
  formatPeriod,
  isApprovable,
  isReversible,
} from '@/lib/commissions/labels'
import { formatRate } from '@/lib/commissions/rates'
import type { CommissionEntry } from '@/lib/commissions/schemas'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { formatInr, isNegativeAmount } from '@/lib/money'

const PAGE_SIZE = 25

const opt = (map: Record<string, string>, any: string) => [{ value: '', label: any }, ...Object.entries(map).map(([value, label]) => ({ value, label }))]

function Amount({ entry }: { entry: CommissionEntry }) {
  if (entry.amount == null) {
    return (
      <Badge variant="orange" data-testid="rate-pending">
        Rate to be published
      </Badge>
    )
  }
  const negative = isNegativeAmount(entry.amount)
  return (
    <span className={negative ? 'font-semibold text-red-700' : 'font-medium'} data-negative={negative ? 'true' : undefined}>
      {formatInr(entry.amount)}
    </span>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-gray-900">{children}</dd>
    </div>
  )
}

function EntryDetail({ entry, onClose, canReverse, onReverse }: { entry: CommissionEntry | null; onClose: () => void; canReverse: boolean; onReverse: (e: CommissionEntry) => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle>Commission entry #{entry.entry_id}</DialogTitle>
              <DialogDescription>
                {ENTRY_KIND_LABEL[entry.kind] ?? entry.kind} · {ENTRY_STATUS_LABEL[entry.status] ?? entry.status}
              </DialogDescription>
            </DialogHeader>
            <dl data-testid="entry-detail" className="divide-y divide-[#e4e8ee]">
              <Detail label="Associate">{entry.associate ? `${entry.associate.full_name} (${entry.associate.associate_id})` : '—'}</Detail>
              <Detail label="Earned as">{EARNING_ROLE_LABEL[entry.earning_role] ?? entry.earning_role}</Detail>
              <Detail label="Customer">
                {entry.onboarding_id != null ? (
                  <Link className="text-[#0e2a63] underline" href={`/dashboard/onboardings/${entry.onboarding_id}`}>
                    {entry.customer_name ?? `Onboarding ${entry.onboarding_id}`}
                  </Link>
                ) : (
                  (entry.customer_name ?? '—')
                )}
                {entry.project_reference_id && <span className="block text-xs text-gray-500">{entry.project_reference_id}</span>}
              </Detail>
              <Detail label="Payment">
                {entry.payment_id != null ? (
                  <Link className="text-[#0e2a63] underline" href={`/dashboard/accounts/payments/${entry.payment_id}`} data-testid="payment-link">
                    Payment #{entry.payment_id}
                  </Link>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Basis">{entry.basis_amount != null ? `${formatInr(entry.basis_amount)} (verified amount without GST)` : '—'}</Detail>
              <Detail label="Rate">
                {formatRate(entry.rate_percent)}
                {entry.rate_source === 'individual' && <Badge variant="blue" className="ml-2" data-testid="individual-rate-tag">Individual rate</Badge>}
                {entry.schedule_version != null && <span className="text-xs text-gray-500"> · schedule v{entry.schedule_version}</span>}
                {entry.agreement_date && <span className="text-xs text-gray-500"> · as on {formatDate(entry.agreement_date)}</span>}
              </Detail>
              {entry.holders != null && entry.holders > 1 && <Detail label="Shared by">{entry.holders} holders (equal share)</Detail>}
              <Detail label="Amount">
                <Amount entry={entry} />
                {entry.amount == null && entry.pending_reason && <span className="mt-1 block text-xs text-gray-600">{PENDING_REASON_LABEL[entry.pending_reason] ?? entry.pending_reason}</span>}
              </Detail>
              {entry.reverses_entry_id != null && <Detail label="Reverses">Entry #{entry.reverses_entry_id}</Detail>}
              {entry.reversed_by_entry_id != null && <Detail label="Reversed by">Entry #{entry.reversed_by_entry_id}</Detail>}
              {entry.reason && <Detail label="Reason">{entry.reason}</Detail>}
              <Detail label="Payout batch">
                {entry.batch ? (
                  <Link className="text-[#0e2a63] underline" href={`/dashboard/commissions/payouts/${entry.batch.batch_id}`}>
                    {formatPeriod(entry.batch.period)} ({entry.batch.status})
                  </Link>
                ) : (
                  'Not in a batch'
                )}
              </Detail>
              <Detail label="Created">{formatDatetime(entry.created_at)}{entry.created_by ? ` · ${entry.created_by}` : ''}</Detail>
              {entry.rated_at && <Detail label="Rated">{formatDatetime(entry.rated_at)}{entry.rated_by ? ` · ${entry.rated_by}` : ''}</Detail>}
              {entry.approved_at && <Detail label="Approved">{formatDatetime(entry.approved_at)}{entry.approved_by ? ` · ${entry.approved_by}` : ''}</Detail>}
              {entry.paid_at && <Detail label="Paid">{formatDatetime(entry.paid_at)}</Detail>}
            </dl>
            {canReverse && isReversible(entry) && (
              <Button variant="destructive" className="h-11 sm:h-9 sm:justify-self-start" onClick={() => onReverse(entry)}>
                Reverse this earning…
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function CommissionEntries() {
  const { role } = useStaffRole()
  const canAct = role === 'admin' || role === 'accounts'
  const isAdmin = role === 'admin'
  const url = useUrlParams()
  const formId = useId()
  const filters = {
    associate_id: url.get('associate') || undefined,
    status: url.get('status') || undefined,
    kind: url.get('kind') || undefined,
    earning_role: url.get('role') || undefined,
    pending: url.get('pending') === '1' ? true : undefined,
    date_from: url.get('from') || undefined,
    date_to: url.get('to') || undefined,
    batch_id: Number(url.get('batch')) || undefined,
  }
  const { data, isLoading, error, refetch, isFetching } = useStaffCommissions({ ...filters, page: url.page, page_size: PAGE_SIZE })
  const approve = useApproveCommissions()
  const reverse = useReverseCommission()
  const [picked, setPicked] = useState<number[]>([])
  const [confirming, setConfirming] = useState(false)
  const [detail, setDetail] = useState<CommissionEntry | null>(null)
  const [reversing, setReversing] = useState<CommissionEntry | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const items = data?.items ?? []
  const approvable = items.filter(isApprovable)
  // A selection only ever counts entries still on this page and still approvable.
  const selected = picked.filter((id) => approvable.some((e) => e.entry_id === id))
  const allPicked = approvable.length > 0 && selected.length === approvable.length

  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        aria-label="Filter commissions"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          url.set({ associate: String(f.get('associate') ?? '').trim() || undefined, from: String(f.get('from') ?? '') || undefined, to: String(f.get('to') ?? '') || undefined })
        }}
      >
        <SelectField className="w-full sm:w-40" label="Status" value={url.get('status')} onChange={(v) => url.set({ status: v || undefined })} options={opt(ENTRY_STATUS_LABEL, 'All statuses')} />
        <SelectField className="w-full sm:w-40" label="Kind" value={url.get('kind')} onChange={(v) => url.set({ kind: v || undefined })} options={opt(ENTRY_KIND_LABEL, 'All kinds')} />
        <SelectField className="w-full sm:w-44" label="Earned as" value={url.get('role')} onChange={(v) => url.set({ role: v || undefined })} options={opt(EARNING_ROLE_LABEL, 'All roles')} />
        <div className="w-full sm:w-44">
          <label htmlFor={`${formId}-associate`} className="mb-1 block text-xs text-gray-500">Associate ID</label>
          <Input id={`${formId}-associate`} name="associate" key={url.get('associate')} defaultValue={url.get('associate')} placeholder="GNA-WB-26-00007" className="h-11 md:h-9" autoComplete="off" />
        </div>
        <div className="w-[48%] sm:w-40">
          <label htmlFor={`${formId}-from`} className="mb-1 block text-xs text-gray-500">From</label>
          <Input id={`${formId}-from`} name="from" type="date" key={url.get('from')} defaultValue={url.get('from')} className="h-11 md:h-9" />
        </div>
        <div className="w-[48%] sm:w-40">
          <label htmlFor={`${formId}-to`} className="mb-1 block text-xs text-gray-500">To</label>
          <Input id={`${formId}-to`} name="to" type="date" key={url.get('to')} defaultValue={url.get('to')} className="h-11 md:h-9" />
        </div>
        <Button type="submit" variant="outline" className="h-11 md:h-9">Apply</Button>
        <Button type="button" variant={filters.pending ? 'default' : 'outline'} className="h-11 md:h-9" aria-pressed={!!filters.pending} onClick={() => url.set({ pending: filters.pending ? undefined : '1' })}>
          Waiting for a rate
        </Button>
      </form>

      {data && (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="commission-totals" aria-label="Totals for the whole filter">
          {([['Earned', formatInr(data.totals.earned)], ['Approved', formatInr(data.totals.approved)], ['Paid', formatInr(data.totals.paid)], ['Waiting for a rate', String(data.totals.pending_count)]] as const).map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="text-xl font-bold text-[#091c3c]">{value}</dd>
              </CardContent>
            </Card>
          ))}
        </dl>
      )}

      {notice && <p role="status" className="rounded-lg border border-[#e4e8ee] bg-white px-4 py-2 text-sm text-gray-700">{notice}</p>}
      {error && <DashboardError error={error} onRetry={() => void refetch()} />}

      {canAct && (
        <div className="flex flex-wrap items-center gap-3">
          <Button className="h-11 md:h-9" disabled={selected.length === 0 || approve.isPending} onClick={() => setConfirming(true)}>
            Approve {selected.length > 0 ? `${selected.length} selected` : 'selected'}
          </Button>
          <p className="text-xs text-gray-500">Only rated, still-earned earnings can be approved. Approved earnings go into the next payout batch.</p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table aria-busy={isFetching}>
            <TableHeader>
              <TableRow>
                {canAct && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Select every approvable earning on this page"
                      className="h-5 w-5"
                      disabled={approvable.length === 0}
                      checked={allPicked}
                      onChange={() => setPicked(allPicked ? [] : approvable.map((e) => e.entry_id))}
                    />
                  </TableHead>
                )}
                <TableHead>Associate</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Earned as</TableHead>
                <TableHead>Basis × rate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead><span className="sr-only">Details</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-gray-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />Loading…</TableCell></TableRow>
              )}
              {items.map((e) => {
                const deduction = e.kind === 'reversal' || e.kind === 'recovery'
                return (
                  <TableRow key={e.entry_id} data-testid="commission-row" data-kind={e.kind} className={deduction ? 'bg-red-50/40' : undefined}>
                    {canAct && (
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select entry ${e.entry_id}`}
                          className="h-5 w-5"
                          disabled={!isApprovable(e)}
                          checked={selected.includes(e.entry_id)}
                          onChange={() => toggle(e.entry_id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      <p className="font-medium text-gray-900">{e.associate?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{e.associate?.associate_id}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="text-gray-900">{e.customer_name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{e.project_reference_id}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {EARNING_ROLE_LABEL[e.earning_role] ?? e.earning_role}
                      {deduction && <Badge variant="red" className="ml-2" data-testid="deduction-badge">{ENTRY_KIND_LABEL[e.kind]}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{e.basis_amount != null ? `${formatInr(e.basis_amount)} × ${formatRate(e.rate_percent)}` : '—'}{e.rate_source === 'individual' && <Badge variant="blue" className="ml-1" data-testid="individual-rate-tag">Individual rate</Badge>}</TableCell>
                    <TableCell><Amount entry={e} /></TableCell>
                    <TableCell><Badge variant={ENTRY_STATUS_VARIANT[e.status] ?? 'gray'}>{ENTRY_STATUS_LABEL[e.status] ?? e.status}</Badge></TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(e.created_at)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="min-h-[44px] md:min-h-0" onClick={() => setDetail(e)}>
                        Details <span className="sr-only">for entry {e.entry_id}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {data && items.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-gray-500">No commission entries match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {data && <QueuePager page={url.page} pageSize={PAGE_SIZE} total={data.total} onPage={url.setPage} />}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Approve ${selected.length} ${selected.length === 1 ? 'earning' : 'earnings'}?`}
        description="Approved earnings are included in the next payout batch. This is all-or-nothing: if any selected entry cannot be approved, none is."
        confirmLabel="Approve"
        describeError={commissionErrorMessage}
        onConfirm={async () => {
          const r = await approve.mutateAsync(selected)
          setPicked([])
          setNotice(`Approved ${r.approved} ${r.approved === 1 ? 'earning' : 'earnings'}.`)
        }}
      />
      <EntryDetail entry={detail} onClose={() => setDetail(null)} canReverse={isAdmin} onReverse={(e) => { setDetail(null); setReversing(e) }} />
      <ReasonDialog
        open={!!reversing}
        onOpenChange={(o) => !o && setReversing(null)}
        title={`Reverse entry #${reversing?.entry_id ?? ''}`}
        description="Policy 4.7 — false information or a breach. The earning is cancelled out; if it was already paid, a recovery is netted against the associate’s next payouts."
        label="Reason (recorded in the audit log)"
        required
        destructive
        confirmLabel="Reverse earning"
        describeError={commissionErrorMessage}
        onConfirm={async (reason) => {
          await reverse.mutateAsync({ entryId: reversing!.entry_id, reason })
          setNotice(`Entry #${reversing!.entry_id} was reversed.`)
        }}
      />
    </div>
  )
}
