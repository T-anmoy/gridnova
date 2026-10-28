'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import PaymentActions from '@/components/dashboard/PaymentActions'
import ProofUpload from '@/components/payments/ProofUpload'
import RecordPaymentForm from '@/components/payments/RecordPaymentForm'
import { useResendReceipt } from '@/lib/dashboard/accounts-api-client'
import { associateCustomerOnboarding, fetchLeadReceipt, useLeadPayments, useRecordLeadPayment, type LeadPaymentOverview } from '@/lib/dashboard/lead-payments-api-client'
import { useUploadStaffPaymentProof } from '@/lib/dashboard/payments-api-client'
import { ATTENTION_LABEL, STATUS_LABEL, STATUS_VARIANT, staffModeLabel, staffPaymentError } from '@/lib/dashboard/payment-ui'
import { STAFF_PAYMENT_COPY } from '@/lib/dashboard/staff-copy'
import { formatDate, formatDatetime } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { usePermissions } from '@/lib/access/use-permissions'
import type { Milestone, StaffPayment } from '@/lib/associate/payment-types'

// The Payments tab of a direct customer's lead (docs/api/direct_payments.md). Every amount,
// due status and total is the server's; nothing is added up or compared here. Accounts and
// Admin record and act (`payments.process`); Management and the lead's Sales owner read.

const DUE_VARIANT: Record<string, 'gray' | 'amber' | 'blue' | 'green'> = { not_due: 'gray', due: 'amber', partially_paid: 'blue', paid: 'green' }

function Totals({ totals }: { totals: LeadPaymentOverview['totals'] }) {
  const items: [string, string | null][] = [
    ['Accepted total', totals.accepted_total],
    ['Verified', totals.paid_verified],
    ['Awaiting verification', totals.awaiting_verification],
    ['Balance', totals.balance],
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4" data-testid="lead-payment-totals">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-gray-500">{label}</dt>
          <dd className="font-semibold">{formatInr(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function Schedule({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="space-y-3" aria-label="Payment schedule">
      {milestones.map((m) => (
        <li key={m.milestone_id} className="rounded-lg border border-[#e4e8ee] p-3" data-testid="lead-milestone">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{m.number}. {m.label}</span>
            <span className="text-xs text-gray-500">{String(m.percent)}%</span>
            <Badge variant={DUE_VARIANT[m.due_status] ?? 'gray'} data-testid="due-chip">
              {STAFF_PAYMENT_COPY.due[m.due_status as keyof typeof STAFF_PAYMENT_COPY.due] ?? m.due_status}
            </Badge>
            {m.overdue && <Badge variant="red" data-testid="overdue-chip">Overdue{m.due_since ? ` (due since ${formatDate(m.due_since)})` : ''}</Badge>}
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-xs text-gray-500">Amount due</dt><dd>{formatInr(m.amount_due)}</dd></div>
            <div><dt className="text-xs text-gray-500">Paid toward</dt><dd>{formatInr(m.paid_toward)}</dd></div>
            <div><dt className="text-xs text-gray-500">Outstanding</dt><dd>{formatInr(m.outstanding)}</dd></div>
          </dl>
        </li>
      ))}
    </ol>
  )
}

/** A verified payment's receipt. While the receipt wording (registry P6) is unsupplied, every receipt is held. */
function ReceiptState({ leadId, p, canAct }: { leadId: number; p: StaffPayment; canAct: boolean }) {
  const { getToken } = useAuth()
  const resend = useResendReceipt()
  const [notice, setNotice] = useState<string | null>(null)
  const r = p.receipt
  if (!r) return null

  if (r.voided) {
    return <p className="text-xs text-gray-600" data-testid="receipt-void">Receipt {r.receipt_number} is void{r.void_reason ? ` — ${r.void_reason}` : ' (the payment was dishonoured)'}.</p>
  }
  if (r.held) {
    return (
      <p className="text-xs text-gray-600" data-testid="receipt-held">
        Receipt numbered {r.receipt_number} — held until Grid Nova approves the receipt wording; it will be sent automatically then.
      </p>
    )
  }

  async function run(fn: () => Promise<void>) {
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      setNotice(staffPaymentError(err))
    }
  }
  const download = () =>
    run(async () => {
      const token = await getToken()
      if (!token) return
      // The signed link is short-lived, so it is fetched on each click, never kept.
      const receipt = await fetchLeadReceipt(leadId, p.payment_id, token)
      if (receipt.pdf_url) window.open(receipt.pdf_url, '_blank', 'noopener')
      else setNotice('The receipt PDF isn’t ready yet. Try again in a minute.')
    })
  const copyLink = () =>
    run(async () => {
      if (!r.url) return
      await navigator.clipboard.writeText(r.url)
      setNotice('The customer’s receipt link is copied.')
    })

  return (
    <div className="space-y-1" data-testid="receipt-ready">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-600">Receipt {r.receipt_number}</span>
        {r.pdf_available && <Button variant="outline" size="sm" onClick={() => void download()}>Download</Button>}
        {r.url && <Button variant="outline" size="sm" onClick={() => void copyLink()}>Copy customer’s link</Button>}
        {canAct && (
          <Button variant="outline" size="sm" disabled={resend.isPending} onClick={() => void run(async () => { await resend.mutateAsync({ paymentId: p.payment_id }); setNotice('Receipt email queued.') })}>
            Resend
          </Button>
        )}
      </div>
      {notice && <p role="status" className="text-xs text-gray-700">{notice}</p>}
    </div>
  )
}

function PaymentRow({ leadId, p, canAct, isAdmin }: { leadId: number; p: StaffPayment; canAct: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const upload = useUploadStaffPaymentProof()
  const live = p.status === 'recorded' || p.status === 'deposited'
  const actionable = canAct && (live || p.status === 'verified')
  return (
    <li className="space-y-2 border-b border-gray-100 pb-3 text-sm last:border-0" data-testid="lead-payment">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{formatInr(p.amount)}</span>
        <Badge variant={STATUS_VARIANT[p.status] ?? 'gray'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
        <span className="text-gray-600">{staffModeLabel(p.mode)} · {p.reference}{p.bank_name ? ` · ${p.bank_name}` : ''}</span>
        {(p.attention_reasons ?? []).filter((x) => x !== 'receipt_held').map((x) => <Badge key={x} variant="orange">{ATTENTION_LABEL[x] ?? x.replace(/_/g, ' ')}</Badge>)}
      </div>
      <p className="text-xs text-gray-500">
        Recorded {formatDatetime(p.recorded_at)}{p.recorded_by ? ` by ${p.recorded_by}` : ''}
        {p.verified_at ? ` · verified ${formatDatetime(p.verified_at)}${p.verified_by ? ` by ${p.verified_by}` : ''}` : ''}
        {p.payer_name ? ` · paid by ${p.payer_name}` : ''}
      </p>
      {p.previous_payment_id != null && <p className="text-xs text-gray-500">Re-presents bounced payment #{p.previous_payment_id}</p>}
      {p.status === 'dishonoured' && p.dishonour_reason && <p className="text-xs text-red-700">Dishonoured: {p.dishonour_reason}</p>}
      {p.status === 'cancelled' && p.cancel_reason && <p className="text-xs text-gray-500">Cancelled: {p.cancel_reason}</p>}
      <ReceiptState leadId={leadId} p={p} canAct={canAct} />
      {actionable && (
        <div>
          <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="px-0 text-[#0e2a63]">
            {open ? 'Hide actions' : 'Actions'}
          </Button>
          {open && (
            <div className="mt-2 space-y-3 rounded-lg bg-[#f7f9fc] p-3" data-testid="lead-payment-actions">
              {live && !p.has_proof && (
                <div>
                  <p className="mb-2 text-xs text-gray-600">Attach proof of payment (photo, screenshot or PDF).</p>
                  <ProofUpload copy={STAFF_PAYMENT_COPY} paymentId={p.payment_id} upload={(pid, file, onProgress) => upload.mutateAsync({ paymentId: pid, file, onProgress })} />
                </div>
              )}
              <PaymentActions p={p} isAdmin={isAdmin} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function RecordLeadPayment({ leadId, data }: { leadId: number; data: LeadPaymentOverview }) {
  const record = useRecordLeadPayment(leadId)
  const upload = useUploadStaffPaymentProof()
  return (
    <RecordPaymentForm
      copy={STAFF_PAYMENT_COPY}
      idPrefix={`lead-pay-${leadId}`}
      modes={data.enabled_modes}
      milestones={data.milestones}
      defaultPayerName={data.project.customer_name}
      describeError={staffPaymentError}
      onRecord={(input) => record.mutateAsync(input)}
      onUploadProof={(paymentId, file, onProgress) => upload.mutateAsync({ paymentId, file, onProgress })}
    />
  )
}

export default function LeadPaymentsTab({ leadId }: { leadId: number }) {
  const { can } = usePermissions()
  const { data, isLoading, error, refetch } = useLeadPayments(leadId)
  // Recording and acting on a direct customer's payment is Accounts / Admin only — not
  // `payments.record`, which Sales holds for associate customers.
  const canAct = can('payments.process')
  const isAdmin = can('payments.segregation_override')

  if (isLoading) return <Card><CardContent className="space-y-3 p-6"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /></CardContent></Card>

  const onboardingId = associateCustomerOnboarding(error)
  if (onboardingId != null) {
    return (
      <Card data-testid="lead-associate-customer">
        <CardContent className="space-y-2 p-6 text-sm">
          <p className="text-gray-800">This customer was brought by an associate, so their payments are on the customer record.</p>
          <Link className="font-medium text-[#0e2a63] underline" href={`/dashboard/onboardings/${onboardingId}#payments`}>Open the customer’s payments</Link>
        </CardContent>
      </Card>
    )
  }
  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (!data) return null

  if (data.milestones.length === 0) {
    return (
      <Card data-testid="lead-payments-not-started">
        <CardContent className="p-6">
          <p className="text-sm text-gray-700">Payments start when the customer accepts the proposal.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4" data-testid="lead-payments">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
          <p className="text-xs text-gray-500" data-testid="lead-payments-customer">
            {data.project.customer_name}{data.project.project_reference_id ? ` · ${data.project.project_reference_id}` : ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Totals totals={data.totals} />
          {data.payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-3" aria-label="Payments">
              {data.payments.map((p) => <PaymentRow key={p.payment_id} leadId={leadId} p={p} canAct={canAct} isAdmin={isAdmin} />)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment schedule</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">The terms the customer accepted. A payment counts toward the instalments in order; its instalment label is only a note.</p>
          <Schedule milestones={data.milestones} />
        </CardContent>
      </Card>

      {canAct && (
        <Card>
          <CardContent className="p-6">
            {/* The server's due status says every instalment is covered — no amount is compared here. */}
            {data.milestones.every((m) => m.due_status === 'paid') ? (
              <p className="text-sm text-gray-700" data-testid="lead-fully-paid">Fully paid — every instalment is covered by verified payments, so there is nothing more to record.</p>
            ) : (
              <RecordLeadPayment leadId={leadId} data={data} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
