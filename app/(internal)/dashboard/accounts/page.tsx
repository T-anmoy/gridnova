'use client'

import { notAuthenticatedError } from '@/lib/api/http'
import { Suspense, useState } from 'react'
import { useUrlParams } from '@/lib/dashboard/use-url-params'
import { useDebouncedValue } from '@/lib/dashboard/use-debounced-value'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClickableRow } from '@/components/dashboard/ClickableRow'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardError } from '@/components/dashboard/DashboardError'
import NoAccess from '@/components/dashboard/NoAccess'
import { downloadExport, useMilestoneQueue, usePaymentList, useReleaseHeldReceipts, useResendReceipt, type ExportKind } from '@/lib/dashboard/accounts-api-client'
import { useWorkQueues } from '@/lib/dashboard/execution-api-client'
import { ATTENTION_LABEL, STATUS_LABEL, STATUS_VARIANT, isDummyReason, matchesFilter, staffPaymentError } from '@/lib/dashboard/payment-ui'
import { useStaffRole } from '@/lib/dashboard/use-staff-role'
import { formatDate } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { STAFF_PAYMENT_COPY } from '@/lib/dashboard/staff-copy'
import DateField from '@/components/forms/DateField'

const MODES = Object.entries(STAFF_PAYMENT_COPY.modes)
const STATUSES = Object.keys(STATUS_LABEL)
type Tab = 'payments' | 'milestones' | 'receipts'

function Pager({ data, page, setPage }: { data?: { total: number; page_size: number; page: number }; page: number; setPage: (n: number) => void }) {
  if (!data || data.total <= data.page_size) return null
  const pages = Math.ceil(data.total / data.page_size)
  return (
    <div className="flex items-center justify-between text-sm text-gray-500">
      <span>Page {data.page} of {pages}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

function Loading() {
  return <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
}

// Who a row is for: the customer's name with the project code under it. Nothing is invented when the
// backend sends neither (the caller supplies the fallback).
function WhoCell({ name, code, fallback }: { name?: string | null; code?: string | null; fallback: React.ReactNode }) {
  if (!name && !code) return <>{fallback}</>
  return (
    <div data-testid="who-cell">
      <p className="font-medium text-gray-900">{name ?? '—'}</p>
      {code && <p className="text-xs text-gray-500">{code}</p>}
    </div>
  )
}

// Backend search for the payment lists (`q`, BE-1 A4): typed text is debounced
// 300 ms, then sent to the server, which filters BEFORE paging — so a match on
// page 7 is found, and `total` is the filtered count. A changed search returns
// to page 1 (state adjusted during render, React's documented alternative to an
// effect); the other filters stay as they are.
function useSearchedPage() {
  const [text, setText] = useState('')
  const q = useDebouncedValue(text.trim(), 300)
  const [page, setPage] = useState(1)
  const [lastQ, setLastQ] = useState(q)
  if (q !== lastQ) {
    setLastQ(q)
    setPage(1)
  }
  return { text, setText, q, page, setPage }
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="sr-only">Search by customer, payment reference, project code or receipt number</span>
      <Input type="search" className="h-11 w-full sm:h-9 sm:w-72" placeholder="Customer, reference, project or receipt no." maxLength={100} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

// Filters the rows already on this page by customer name or project code — no extra request.
function RowFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="sr-only">Filter this page by customer or project code</span>
      <Input type="search" className="h-9 w-64" placeholder="Filter this page by customer or project code" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function AttentionBadges({ reasons }: { reasons: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.map((r) => <Badge key={r} variant="orange" data-testid="attention-chip">{ATTENTION_LABEL[r] ?? r.replace(/_/g, ' ')}</Badge>)}
    </div>
  )
}

function PaymentsTab() {
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('')
  const [needsAttention, setNeedsAttention] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { text, setText, q, page, setPage } = useSearchedPage()
  const { data, isLoading, error, refetch } = usePaymentList({
    status: status || undefined,
    mode: mode || undefined,
    needs_attention: needsAttention || undefined,
    date_from: from || undefined,
    date_to: to || undefined,
    q: q || undefined,
    page,
    page_size: 25,
  })
  const reset = () => setPage(1)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={needsAttention ? 'default' : 'outline'} size="sm" aria-pressed={needsAttention} onClick={() => { setNeedsAttention((v) => !v); reset() }}>
          Needs attention
        </Button>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); reset() }}>
          <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mode || 'all'} onValueChange={(v) => { setMode(v === 'all' ? '' : v); reset() }}>
          <SelectTrigger className="w-40" aria-label="Payment method"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {MODES.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">From <DateField variant="dashboard" label="From" max={to || undefined}  value={from} onChange={(v) => { setFrom(v); reset() }} /></div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">To <DateField variant="dashboard" label="To" min={from || undefined}  value={to} onChange={(v) => { setTo(v); reset() }} /></div>
        <SearchBox value={text} onChange={setText} />
      </div>
      {error && <DashboardError error={error} onRetry={() => void refetch()} />}
      <Card>
        <CardContent className="p-0">
          {isLoading ? <Loading /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead><TableHead>Attention</TableHead><TableHead>Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((p) => (
                  <ClickableRow key={p.payment_id} data-testid="payment-row" href={`/dashboard/accounts/payments/${p.payment_id}`}>
                    <TableCell className="text-sm">
                      <Link href={`/dashboard/accounts/payments/${p.payment_id}`} className="hover:underline">
                        <WhoCell name={p.customer_name} code={p.project_reference_id} fallback={null} />
                        <p className="text-xs text-gray-500">Payment #{p.payment_id}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{formatInr(p.amount)}</TableCell>
                    <TableCell className="text-sm">{STAFF_PAYMENT_COPY.modes[p.mode as keyof typeof STAFF_PAYMENT_COPY.modes] ?? p.mode}</TableCell>
                    <TableCell className="text-sm">{p.reference}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[p.status] ?? 'gray'}>{STATUS_LABEL[p.status] ?? p.status}</Badge></TableCell>
                    <TableCell><AttentionBadges reasons={p.attention_reasons ?? []} /></TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(p.recorded_at)}</TableCell>
                  </ClickableRow>
                ))}
                {data && data.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">No payments match.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  )
}

function MilestonesTab() {
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useMilestoneQueue({ needs_attention: overdueOnly || undefined, page, page_size: 25 })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={overdueOnly ? 'default' : 'outline'} size="sm" aria-pressed={overdueOnly} onClick={() => { setOverdueOnly((v) => !v); setPage(1) }}>
          Overdue only
        </Button>
        <RowFilter value={filter} onChange={setFilter} />
      </div>
      {error && <DashboardError error={error} onRetry={() => void refetch()} />}
      <Card>
        <CardContent className="p-0">
          {isLoading ? <Loading /> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Customer</TableHead><TableHead>Instalment</TableHead><TableHead>Due</TableHead><TableHead>Paid so far</TableHead><TableHead>Outstanding</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.filter((m) => matchesFilter(filter, m.customer_name, m.project_reference_id)).map((m) => (
                  <TableRow key={m.milestone_id} data-testid="milestone-row">
                    <TableCell className="text-sm">
                      <WhoCell
                        name={m.customer_name}
                        code={m.project_reference_id}
                        fallback={m.onboarding_id != null ? <Link className="text-[#0e2a63] underline" href={`/dashboard/onboardings/${m.onboarding_id}`}>Project {m.project_id ?? m.onboarding_id}</Link> : <>Project {m.project_id ?? '—'}</>}
                      />
                      {(m.customer_name || m.project_reference_id) && m.onboarding_id != null && (
                        <Link className="text-xs text-[#0e2a63] underline" href={`/dashboard/onboardings/${m.onboarding_id}`}>Open project</Link>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{m.label} <span className="text-gray-500">({String(m.percent)}%)</span></TableCell>
                    <TableCell>{formatInr(m.amount_due)}</TableCell>
                    <TableCell>{formatInr(m.paid_toward)}</TableCell>
                    <TableCell>{formatInr(m.outstanding)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{STAFF_PAYMENT_COPY.due[m.due_status as keyof typeof STAFF_PAYMENT_COPY.due] ?? m.due_status}</Badge>
                        {(m.overdue || m.needs_attention) && <Badge variant="red" data-testid="overdue-chip">Overdue{m.due_since ? ` since ${formatDate(m.due_since)}` : ''}</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data && !data.items.some((m) => matchesFilter(filter, m.customer_name, m.project_reference_id)) && <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500">No instalments match.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  )
}

// Receipts are derived from verified payments (there is no separate list endpoint).
function ReceiptsTab({ canAct }: { canAct: boolean }) {
  const [needsAttention, setNeedsAttention] = useState(false)
  const { text, setText, q, page, setPage } = useSearchedPage()
  const [notice, setNotice] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = usePaymentList({ status: 'verified', needs_attention: needsAttention || undefined, q: q || undefined, page, page_size: 25 })
  const resend = useResendReceipt()
  const release = useReleaseHeldReceipts()

  async function handleRelease() {
    setNotice(null)
    try {
      const r = await release.mutateAsync()
      setNotice(`Released ${r.released}; still held ${r.still_held}${r.reason ? ` — ${r.reason}` : ''}.`)
    } catch (err) {
      setNotice(staffPaymentError(err))
    }
  }
  async function handleResend(paymentId: number) {
    setNotice(null)
    try {
      await resend.mutateAsync({ paymentId })
      setNotice('Receipt email queued.')
    } catch (err) {
      setNotice(staffPaymentError(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={needsAttention ? 'default' : 'outline'} size="sm" aria-pressed={needsAttention} onClick={() => { setNeedsAttention((v) => !v); setPage(1) }}>
          Needs attention
        </Button>
        {canAct && <Button variant="outline" size="sm" disabled={release.isPending} onClick={() => void handleRelease()}>Release held receipts</Button>}
        <SearchBox value={text} onChange={setText} />
      </div>
      {notice && <p role="status" className="rounded-lg border border-[#e4e8ee] bg-white px-4 py-2 text-sm text-gray-700">{notice}</p>}
      {error && <DashboardError error={error} onRetry={() => void refetch()} />}
      <Card>
        <CardContent className="p-0">
          {isLoading ? <Loading /> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Receipt</TableHead><TableHead>Customer</TableHead><TableHead>Payment</TableHead><TableHead>Amount</TableHead><TableHead>Customer email</TableHead><TableHead>State</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((p) => {
                  const r = p.receipt
                  const reasons = (p.attention_reasons ?? []).filter((x) => x.startsWith('receipt_'))
                  return (
                    <TableRow key={p.payment_id} data-testid="receipt-row">
                      <TableCell className="text-sm">{r?.receipt_number ?? '—'}</TableCell>
                      <TableCell className="text-sm"><WhoCell name={p.customer_name} code={p.project_reference_id} fallback="—" /></TableCell>
                      <TableCell className="text-sm"><Link className="text-[#0e2a63] underline" href={`/dashboard/accounts/payments/${p.payment_id}`}>#{p.payment_id}</Link></TableCell>
                      <TableCell>{formatInr(p.amount)}</TableCell>
                      <TableCell className="text-sm">{r ? (r.email_skipped_reason ? `Not sent: ${r.email_skipped_reason}` : r.email_status ?? '—') : '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <AttentionBadges reasons={reasons} />
                          {r?.held && isDummyReason(r.held_reason) && <Badge variant="orange" data-testid="dummy-chip">Dummy / pending Grid Nova</Badge>}
                        </div>
                        {r?.held && r.held_reason && <p className="mt-1 text-xs text-gray-500">{r.held_reason}</p>}
                      </TableCell>
                      <TableCell className="text-right">
                        {canAct && r && <Button variant="outline" size="sm" onClick={() => void handleResend(p.payment_id)}>Resend</Button>}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {data && data.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">No receipts match.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  )
}

function ExportPanel() {
  const { getToken } = useAuth()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<ExportKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function run(kind: ExportKind) {
    setError(null)
    setBusy(kind)
    try {
      const token = await getToken()
      if (!token) throw notAuthenticatedError()
      await downloadExport(kind, token, { date_from: from || undefined, date_to: to || undefined })
    } catch (err) {
      setError(staffPaymentError(err))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4" data-testid="export-panel">
        <div className="text-xs text-gray-500">From<DateField variant="dashboard" label="Export from" max={to || undefined} className="mt-1" value={from} onChange={setFrom} /></div>
        <div className="text-xs text-gray-500">To<DateField variant="dashboard" label="Export to" min={from || undefined} className="mt-1" value={to} onChange={setTo} /></div>
        {(['payments', 'receipts', 'ledger'] as const).map((k) => (
          <Button key={k} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run(k)}>
            <Download className="mr-1 h-3 w-3" /> {k.charAt(0).toUpperCase() + k.slice(1)} CSV
          </Button>
        ))}
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  )
}

function AccountsWorkspace({ canAct }: { canAct: boolean }) {
  // The active tab lives in the URL (?tab=milestones) so it survives a reload and can be shared.
  const url = useUrlParams()
  const rawTab = url.get('tab')
  const tab: Tab = rawTab === 'milestones' || rawTab === 'receipts' ? rawTab : 'payments'
  const setTab = (t: Tab) => url.set({ tab: t === 'payments' ? undefined : t })
  const { data: queues } = useWorkQueues()
  const q = queues?.payments
  const tiles: [string, number | undefined][] = [
    ['Awaiting verification', q?.awaiting_verification],
    ['Dishonoured', q?.dishonoured],
    ['Receipts held', q?.receipts_held],
    ['Receipts without email', q?.receipts_without_email],
    ['Overdue instalments', q?.overdue_milestones],
  ]
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-[#091c3c]">Accounts</h1>
        {!canAct && <p className="mt-1 text-sm text-gray-500">Read-only view.</p>}
      </div>
      {q && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="queue-summary">
          {tiles.map(([label, n]) => (
            <Card key={label}><CardContent className="p-4"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold">{n ?? 0}</p></CardContent></Card>
          ))}
        </div>
      )}
      <div role="tablist" className="flex gap-2">
        {(['payments', 'milestones', 'receipts'] as const).map((t) => (
          <Button key={t} role="tab" aria-selected={tab === t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)}>
            {t === 'payments' ? 'Payments' : t === 'milestones' ? 'Instalments' : 'Receipts'}
          </Button>
        ))}
      </div>
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'milestones' && <MilestonesTab />}
      {tab === 'receipts' && <ReceiptsTab canAct={canAct} />}
      {canAct && <ExportPanel />}
    </div>
  )
}

// Operations, engineers and sales get no Accounts workspace (sales reach their own
// customers' payments from the customer page). Role is checked before any payment request is made.
export default function AccountsPage() {
  const { role, isLoaded } = useStaffRole()
  if (!isLoaded) return <div className="p-8"><Skeleton className="h-8 w-48" /></div>
  if (role !== 'admin' && role !== 'accounts' && role !== 'management') return <NoAccess what="The Accounts workspace" />
  return (
    // useSearchParams needs a Suspense boundary.
    <Suspense fallback={<div className="p-8"><Skeleton className="h-8 w-48" /></div>}>
      <AccountsWorkspace canAct={role === 'admin' || role === 'accounts'} />
    </Suspense>
  )
}
