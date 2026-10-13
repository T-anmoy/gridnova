'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { AlertTriangle, ArrowLeft, Landmark } from 'lucide-react'
import Link from '@/components/i18n/Link'
import { DashboardError } from '@/components/dashboard/DashboardError'
import { useOnboarding } from '@/lib/associate/onboarding-api-client'
import ProofUpload from '@/components/payments/ProofUpload'
import RecordPaymentForm from '@/components/payments/RecordPaymentForm'
import { paymentErrorMessage, type PaymentCopy } from '@/components/payments/payment-errors'
import { humanize } from '@/lib/associate/execution-labels'
import {
  fetchPaymentProofLink,
  useCancelCustomerPayment,
  useCustomerPayments,
  usePaymentInstructions,
  useRecordCustomerPayment,
  useUploadPaymentProof,
} from '@/lib/associate/payment-api-client'
import { ApiError, wrongAccountOf } from '@/lib/dashboard/api-error'
import { formatDate } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { useMilestoneLabel } from '@/lib/pricing/useMilestoneLabel'
import type { Milestone, Payment, PaymentOverview } from '@/lib/associate/payment-types'

const CHIP: Record<string, string> = {
  recorded: 'bg-[#f7a800]/15 text-[#7a5200]',
  deposited: 'bg-[#2f5daa]/10 text-[#0e2a63]',
  verified: 'bg-emerald-100 text-emerald-800',
  dishonoured: 'bg-red-100 text-red-800',
  cancelled: 'bg-[#111827]/10 text-[#111827]/60',
}

function Card({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'warn' }) {
  return <div className={`rounded-2xl border p-5 ${tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-[#e4e8ee] bg-white'}`}>{children}</div>
}

// The backend names the message it wants shown; unknown keys fall back to the generic text.
const INSTRUCTION_KEYS = {
  'payments.instructions.not_ready': 'instructionNotReady',
  'payments.instructions.pay_only_here': 'instructionPayOnlyHere',
} as const

function Instructions({ copy }: { copy: PaymentCopy }) {
  const { data, isLoading } = usePaymentInstructions()
  return (
    <Card tone="warn">
      <p className="flex items-start gap-2 font-utility text-sm font-semibold text-amber-900" data-testid="no-cash-banner">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {copy.banner}
      </p>
      {isLoading ? (
        <div className="mt-3 h-16 animate-pulse rounded-xl bg-amber-100" role="status" aria-busy="true" />
      ) : data?.available && data.account ? (
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label={copy.accountTitle}>
          <dt className="text-amber-900/70">{copy.payee}</dt>
          <dd className="font-semibold text-amber-950">{data.account.payee}</dd>
          <dt className="text-amber-900/70">{copy.bank}</dt>
          <dd className="font-semibold text-amber-950">{data.account.bank_name}</dd>
          <dt className="text-amber-900/70">{copy.accountNumber}</dt>
          <dd className="font-semibold text-amber-950">{data.account.account_number}</dd>
          <dt className="text-amber-900/70">{copy.ifsc}</dt>
          <dd className="font-semibold text-amber-950">{data.account.ifsc}</dd>
          {data.message_key && data.message_key in INSTRUCTION_KEYS && (
            <p className="mt-2 text-sm text-amber-900/80 sm:col-span-2" data-testid="instruction-message">
              {copy[INSTRUCTION_KEYS[data.message_key as keyof typeof INSTRUCTION_KEYS]]}
            </p>
          )}
        </dl>
      ) : (
        // Never an account here unless the backend says it is real.
        <div className="mt-3" data-testid="details-pending">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-1 font-utility text-xs font-semibold text-amber-900">
            <Landmark className="h-3 w-3" /> {copy.detailsPending}
          </span>
          <p className="mt-2 text-sm text-amber-900/80">
            {data?.message_key === 'payments.instructions.not_ready' ? copy.instructionNotReady : copy.detailsPendingBody}
          </p>
        </div>
      )}
    </Card>
  )
}

function Milestones({ milestones, copy }: { milestones: Milestone[]; copy: PaymentCopy }) {
  const milestoneLabel = useMilestoneLabel()
  if (milestones.length === 0) return null
  return (
    <Card>
      <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.milestonesTitle}</p>
      <ul className="mt-3 space-y-3">
        {milestones.map((m) => {
          const status = m.overdue ? 'overdue' : m.due_status
          const collect = m.overdue || m.due_status === 'due' || m.due_status === 'partially_paid'
          return (
            <li key={m.milestone_id} className="rounded-xl border border-[#e4e8ee] p-3" data-testid="milestone">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-utility text-sm font-semibold text-[#091c3c]">{milestoneLabel(m.label)}</p>
                <span
                  className={`rounded-full px-2.5 py-1 font-utility text-xs font-semibold ${
                    m.overdue ? 'bg-red-100 text-red-800' : m.due_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : collect ? 'bg-[#f7a800]/15 text-[#7a5200]' : 'bg-[#111827]/10 text-[#111827]/60'
                  }`}
                >
                  {copy.due[status as keyof PaymentCopy['due']] ?? humanize(status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#111827]/65">{copy.milestonePercent.replace('{percent}', String(m.percent))}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-[#111827]/65">{copy.amountDue}</dt><dd className="font-semibold">{formatInr(m.amount_due)}</dd></div>
                <div><dt className="text-[#111827]/65">{copy.paidToward}</dt><dd className="font-semibold">{formatInr(m.paid_toward)}</dd></div>
                <div><dt className="text-[#111827]/65">{copy.outstanding}</dt><dd className="font-semibold">{formatInr(m.outstanding)}</dd></div>
              </dl>
              {collect && <p className="mt-2 font-utility text-sm font-semibold text-[#7a5200]" data-testid="collect-this">{copy.collectThis}</p>}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[11px] text-[#111827]/65">{copy.milestoneNote}</p>
    </Card>
  )
}

function PaymentRow({
  payment,
  overview,
  onboardingId,
  copy,
}: {
  payment: Payment
  overview: PaymentOverview
  onboardingId: number
  copy: PaymentCopy
}) {
  const milestoneLabel = useMilestoneLabel()
  const { getToken } = useAuth()
  const upload = useUploadPaymentProof(onboardingId)
  const cancel = useCancelCustomerPayment(onboardingId)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const milestone = overview.milestones.find((m) => m.milestone_id === payment.milestone_id)
  const proofNeeded = !payment.has_proof && (payment.status === 'recorded' || payment.status === 'deposited')
  const receipt = payment.receipt

  async function openProof() {
    const token = await getToken()
    if (!token) return
    try {
      const link = await fetchPaymentProofLink(onboardingId, payment.payment_id, token)
      window.open(link.url, '_blank', 'noopener')
    } catch (err) {
      setError(paymentErrorMessage(err, copy))
    }
  }

  async function handleCancel() {
    setError(null)
    if (!reason.trim()) {
      setError(copy.errors.reason_required)
      return
    }
    try {
      await cancel.mutateAsync({ paymentId: payment.payment_id, reason: reason.trim() })
      setCancelling(false)
    } catch (err) {
      setError(paymentErrorMessage(err, copy))
    }
  }

  return (
    <li className="rounded-xl border border-[#e4e8ee] p-3" data-testid="payment-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-utility text-base font-semibold text-[#091c3c]">{formatInr(payment.amount)}</p>
        <span className={`rounded-full px-2.5 py-1 font-utility text-xs font-semibold ${CHIP[payment.status] ?? CHIP.cancelled}`}>
          {copy.status[payment.status as keyof PaymentCopy['status']] ?? humanize(payment.status)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#111827]/60">
        {copy.modes[payment.mode as keyof PaymentCopy['modes']] ?? humanize(payment.mode)} · {payment.reference} · {formatDate(payment.recorded_at)}
      </p>
      {milestone && <p className="mt-1 text-xs text-[#111827]/65">{copy.forMilestone.replace('{label}', milestoneLabel(milestone.label))}</p>}
      {payment.previous_payment_id != null && (
        <p className="mt-1 text-xs text-[#111827]/60" data-testid="replaces">{copy.replaces.replace('{id}', String(payment.previous_payment_id))}</p>
      )}
      {payment.status === 'dishonoured' && payment.dishonour_reason && (
        <p className="mt-1 text-xs text-red-700">{copy.bouncedReason.replace('{reason}', payment.dishonour_reason)}</p>
      )}
      {payment.status === 'cancelled' && payment.cancel_reason && <p className="mt-1 text-xs text-[#111827]/65">{payment.cancel_reason}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {proofNeeded && (
          <span data-testid="proof-needed" className="rounded-full bg-red-100 px-2.5 py-1 font-utility text-xs font-semibold text-red-800">
            {copy.proofNeeded}
          </span>
        )}
        {payment.has_proof && (
          <button type="button" onClick={() => void openProof()} className="min-h-[44px] font-utility text-sm font-semibold text-[#0e2a63] underline">
            {copy.viewProof}
          </button>
        )}
        {payment.status === 'verified' && receipt && (
          receipt.url && !receipt.held ? (
            <a href={receipt.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-utility text-sm font-semibold text-[#0e2a63] underline">
              {copy.receipt.replace('{number}', receipt.receipt_number)}
            </a>
          ) : (
            <span className="font-utility text-xs text-[#111827]/65">{copy.receiptPending}</span>
          )
        )}
      </div>

      {proofNeeded && <div className="mt-2"><ProofUpload copy={copy} paymentId={payment.payment_id} upload={(pid, file, onProgress) => upload.mutateAsync({ paymentId: pid, file, onProgress })} /></div>}

      {payment.status === 'recorded' && (
        <div className="mt-2">
          {cancelling ? (
            <div className="space-y-2">
              <label htmlFor={`cancel-${payment.payment_id}`} className="block font-utility text-xs text-[#111827]/65">{copy.cancelReason}</label>
              <input id={`cancel-${payment.payment_id}`} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full min-h-[44px] rounded-xl border border-[#e4e8ee] px-4 py-2 text-sm" />
              <div className="flex gap-3">
                <button type="button" onClick={() => void handleCancel()} disabled={cancel.isPending} className="min-h-[44px] rounded-lg bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{copy.cancelConfirm}</button>
                <button type="button" onClick={() => { setCancelling(false); setError(null) }} className="min-h-[44px] text-sm font-semibold text-[#0e2a63] underline">{copy.keep}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCancelling(true)} className="min-h-[44px] font-utility text-sm font-semibold text-red-700 underline">{copy.cancel}</button>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </li>
  )
}

export default function PortalPayments({
  onboardingId,
  portalBase,
  copy,
  defaultPayerName,
}: {
  onboardingId: number
  portalBase: '/associates/portal' | '/preferred/portal'
  copy: PaymentCopy
  defaultPayerName?: string
}) {
  const { data, isLoading, error, refetch } = useCustomerPayments(onboardingId)
  const record = useRecordCustomerPayment(onboardingId)
  const upload = useUploadPaymentProof(onboardingId)
  // The payer is usually the customer: pre-fill the name.
  const { data: onboarding } = useOnboarding(onboardingId)

  const back = (
    <Link href={`${portalBase}/customers/${onboardingId}`} className="inline-flex min-h-[44px] items-center gap-1.5 font-utility text-sm font-semibold text-[#0e2a63]">
      <ArrowLeft className="h-4 w-4" /> {copy.backToCustomer}
    </Link>
  )

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-busy="true">
        {back}
        <div className="h-24 animate-pulse rounded-2xl bg-[#eef1f6]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#eef1f6]" />
        <span className="sr-only">{copy.loading}</span>
      </div>
    )
  }

  if (error) {
    // 403 from the payments route = not this customer's owner (e.g. a Preferred
    // Associate on a downline customer). A wrong-account 403 is handled by DashboardError.
    const notOwner = error instanceof ApiError && error.status === 403 && !wrongAccountOf(error)
    return (
      <div className="space-y-4">
        {back}
        {notOwner ? (
          <Card><p className="text-sm text-[#111827]/70" data-testid="not-owner">{copy.notOwner}</p></Card>
        ) : (
          <DashboardError error={error} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="space-y-5">
      {back}
      <h1 className="font-display text-2xl font-bold text-[#091c3c]">{copy.title}</h1>
      <Instructions copy={copy} />

      <Card>
        <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.totalsTitle}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm" data-testid="totals">
          <div><dt className="text-xs text-[#111827]/65">{copy.total}</dt><dd className="font-semibold">{formatInr(data.totals.accepted_total)}</dd></div>
          <div><dt className="text-xs text-[#111827]/65">{copy.paidVerified}</dt><dd className="font-semibold">{formatInr(data.totals.paid_verified)}</dd></div>
          <div><dt className="text-xs text-[#111827]/65">{copy.awaiting}</dt><dd className="font-semibold">{formatInr(data.totals.awaiting_verification)}</dd></div>
          <div><dt className="text-xs text-[#111827]/65">{copy.balance}</dt><dd className="font-semibold">{formatInr(data.totals.balance)}</dd></div>
        </dl>
      </Card>

      <Milestones milestones={data.milestones} copy={copy} />

      <Card>
        <RecordPaymentForm
          copy={copy}
          idPrefix={`portal-pay-${onboardingId}`}
          modes={data.enabled_modes}
          milestones={data.milestones}
          defaultPayerName={defaultPayerName ?? onboarding?.customer.name}
          onRecord={async (input) => (await record.mutateAsync(input)).payment}
          onUploadProof={(pid, file, onProgress) => upload.mutateAsync({ paymentId: pid, file, onProgress })}
        />
      </Card>

      <Card>
        <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.listTitle}</p>
        {data.payments.length === 0 ? (
          <p className="mt-3 text-sm text-[#111827]/65">{copy.empty}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.payments.map((p) => (
              <PaymentRow key={p.payment_id} payment={p} overview={data} onboardingId={onboardingId} copy={copy} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
