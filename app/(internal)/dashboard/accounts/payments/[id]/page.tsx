'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import NoAccess from '@/components/dashboard/NoAccess'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import ProofUpload from '@/components/payments/ProofUpload'
import {
  fetchStaffPaymentProofLink,
  useCancelStaffPayment,
  useDepositPayment,
  useDishonourPayment,
  usePaymentDetail,
  useResendReceipt,
  useVerifyPayment,
  type PaymentDetail,
} from '@/lib/dashboard/accounts-api-client'
import { useUploadStaffPaymentProof } from '@/lib/dashboard/payments-api-client'
import { ATTENTION_LABEL, STATUS_LABEL, STATUS_VARIANT, isDummyReason, isSelfVerification, staffPaymentError } from '@/lib/dashboard/payment-ui'
import { STAFF_PAYMENT_COPY } from '@/lib/dashboard/staff-copy'
import { formatDatetime } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { usePermissions } from '@/lib/access/use-permissions'

const INSTRUMENT_MODES = ['cheque', 'demand_draft']

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{children}</dd>
    </div>
  )
}

function PaymentDetailView({ p, canAct, isAdmin }: { p: PaymentDetail; canAct: boolean; isAdmin: boolean }) {
  const { getToken } = useAuth()
  const deposit = useDepositPayment()
  const verify = useVerifyPayment()
  const dishonour = useDishonourPayment()
  const cancel = useCancelStaffPayment()
  const resend = useResendReceipt()
  const uploadProof = useUploadStaffPaymentProof(p.project.onboarding_id ?? undefined)
  const [dialog, setDialog] = useState<'verify' | 'dishonour' | 'cancel' | null>(null)
  const [selfConflict, setSelfConflict] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const open = p.status === 'recorded' || p.status === 'deposited'
  const canDeposit = canAct && p.status === 'recorded' && INSTRUMENT_MODES.includes(p.mode)
  const canVerify = canAct && open
  const canDishonour = canAct && (open || p.status === 'verified')
  const canCancel = canAct && open
  const receipt = p.receipt
  const proofMissing = !p.has_proof && open

  async function viewProof() {
    setNotice(null)
    try {
      const token = await getToken()
      if (!token) return
      const link = await fetchStaffPaymentProofLink(p.payment_id, token)
      window.open(link.url, '_blank', 'noopener')
    } catch (err) {
      setNotice(staffPaymentError(err))
    }
  }

  async function act(run: () => Promise<unknown>, ok: string) {
    setNotice(null)
    try {
      await run()
      setNotice(ok)
    } catch (err) {
      setNotice(staffPaymentError(err))
    }
  }

  return (
    <div className="space-y-4" data-testid="payment-detail">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Payment #{p.payment_id} — {formatInr(p.amount)}</CardTitle>
            <Badge variant={STATUS_VARIANT[p.status] ?? 'gray'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
            {(p.attention_reasons ?? []).map((r) => <Badge key={r} variant="orange" data-testid="attention-chip">{ATTENTION_LABEL[r] ?? r.replace(/_/g, ' ')}</Badge>)}
            {proofMissing && !(p.attention_reasons ?? []).includes('proof_missing') && <Badge variant="red">Proof missing</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {p.previous_payment_id != null && (
            <p className="mb-2 text-sm text-gray-600" data-testid="replaces">
              Replaces bounced payment{' '}
              <Link className="text-[#0e2a63] underline" href={`/dashboard/accounts/payments/${p.previous_payment_id}`}>#{p.previous_payment_id}</Link>
            </p>
          )}
          <dl>
            <Row label="Method">{STAFF_PAYMENT_COPY.modes[p.mode as keyof typeof STAFF_PAYMENT_COPY.modes] ?? p.mode}</Row>
            <Row label="Reference">{p.reference}</Row>
            {p.bank_name && <Row label="Bank">{p.bank_name}</Row>}
            {p.instrument_date && <Row label="Instrument date">{p.instrument_date}</Row>}
            {p.payer_name && <Row label="Payer">{p.payer_name}</Row>}
            <Row label="Recorded">{formatDatetime(p.recorded_at)}{p.recorded_by ? ` · ${p.recorded_by}` : ''}</Row>
            {p.deposited_at && <Row label="Deposited">{formatDatetime(p.deposited_at)}{p.deposited_by ? ` · ${p.deposited_by}` : ''}</Row>}
            {p.verified_at && <Row label="Verified">{formatDatetime(p.verified_at)}{p.verified_by ? ` · ${p.verified_by}` : ''}</Row>}
            {p.dishonoured_at && <Row label="Dishonoured">{formatDatetime(p.dishonoured_at)}{p.dishonoured_by ? ` · ${p.dishonoured_by}` : ''}{p.dishonour_reason ? ` — ${p.dishonour_reason}` : ''}</Row>}
            {p.cancelled_at && <Row label="Cancelled">{formatDatetime(p.cancelled_at)}{p.cancelled_by ? ` · ${p.cancelled_by}` : ''}{p.cancel_reason ? ` — ${p.cancel_reason}` : ''}</Row>}
            <Row label="Proof">
              {p.has_proof ? <Button variant="outline" size="sm" onClick={() => void viewProof()}>View {p.proof_filename ?? 'proof'}</Button> : <span className="text-gray-500">None attached</span>}
            </Row>
          </dl>
          {proofMissing && canAct && (
            <div className="mt-3 border-t pt-3" data-testid="staff-proof-upload">
              <p className="mb-2 text-sm text-gray-600">Attach proof of payment (photo, screenshot or PDF).</p>
              <ProofUpload copy={STAFF_PAYMENT_COPY} paymentId={p.payment_id} upload={(pid, file, onProgress) => uploadProof.mutateAsync({ paymentId: pid, file, onProgress })} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Project</CardTitle></CardHeader>
        <CardContent>
          <dl data-testid="project-block">
            <Row label="Customer">
              {p.project.onboarding_id != null
                ? <Link className="text-[#0e2a63] underline" href={`/dashboard/onboardings/${p.project.onboarding_id}`}>{p.project.customer_name}</Link>
                : p.project.customer_name}
            </Row>
            {p.project.project_reference_id && <Row label="Reference">{p.project.project_reference_id}</Row>}
            <Row label="Accepted total">{formatInr(p.project.accepted_total)}</Row>
            <Row label="Verified so far">{formatInr(p.project.paid_verified)}</Row>
            <Row label="Awaiting verification">{formatInr(p.project.awaiting_verification)}</Row>
            <Row label="Balance">{formatInr(p.project.balance)}</Row>
          </dl>
        </CardContent>
      </Card>

      {receipt && (
        <Card>
          <CardHeader><CardTitle className="text-base">Receipt</CardTitle></CardHeader>
          <CardContent>
            <dl data-testid="receipt-block">
              <Row label="Number">{receipt.receipt_number}</Row>
              <Row label="Email">{receipt.email_skipped_reason ? `Not sent: ${receipt.email_skipped_reason}` : receipt.email_status ?? '—'}{receipt.emailed_at ? ` · ${formatDatetime(receipt.emailed_at)}` : ''}</Row>
              {receipt.held && (
                <Row label="Held">
                  {receipt.held_reason ?? 'Held'}{' '}
                  {isDummyReason(receipt.held_reason) && <Badge variant="orange" data-testid="dummy-chip">Dummy / pending Grid Nova</Badge>}
                </Row>
              )}
              {receipt.render_error && <Row label="Render error"><span className="text-red-600">{receipt.render_error}</span></Row>}
              {receipt.url && !receipt.held && <Row label="PDF"><a className="text-[#0e2a63] underline" href={receipt.url} target="_blank" rel="noopener noreferrer">Open receipt</a></Row>}
            </dl>
            {canAct && (
              <Button className="mt-3" variant="outline" size="sm" disabled={resend.isPending} onClick={() => void act(() => resend.mutateAsync({ paymentId: p.payment_id }), 'Receipt email queued.')}>
                Resend receipt
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {canAct && (
        <div className="flex flex-wrap gap-2" data-testid="payment-actions">
          {canDeposit && <Button variant="outline" disabled={deposit.isPending} onClick={() => void act(() => deposit.mutateAsync({ paymentId: p.payment_id }), 'Marked as deposited.')}>Mark deposited</Button>}
          {canVerify && <Button onClick={() => { setSelfConflict(false); setDialog('verify') }}>Verify</Button>}
          {canDishonour && <Button variant="outline" onClick={() => setDialog('dishonour')}>Dishonour</Button>}
          {canCancel && <Button variant="outline" onClick={() => setDialog('cancel')}>Cancel payment</Button>}
        </div>
      )}
      {notice && <p role="status" className="rounded-lg border border-[#e4e8ee] bg-white px-4 py-2 text-sm text-gray-700">{notice}</p>}

      <ReasonDialog
        open={dialog === 'verify'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Verify payment"
        description={
          selfConflict && !isAdmin
            ? 'You recorded this payment yourself, so you can’t verify it. Another person in Accounts has to.'
            : selfConflict
              ? 'You recorded this payment yourself. As an Admin you can still verify it, but you must give a reason.'
              : 'Verifying confirms the money has reached Grid Nova’s bank account. It writes the ledger entry and issues the receipt.'
        }
        label={selfConflict && isAdmin ? 'Reason (required)' : 'Note (optional)'}
        required={selfConflict && isAdmin}
        confirmDisabled={selfConflict && !isAdmin}
        confirmLabel={selfConflict && isAdmin ? 'Verify as admin' : 'Verify'}
        describeError={staffPaymentError}
        onConfirm={async (reason) => {
          try {
            await verify.mutateAsync({ paymentId: p.payment_id, reason: reason || undefined })
          } catch (err) {
            if (isSelfVerification(err)) setSelfConflict(true)
            throw err
          }
          setNotice('Payment verified.')
        }}
      />
      <ReasonDialog
        open={dialog === 'dishonour'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Dishonour payment"
        description={p.status === 'verified' ? 'This payment is already verified: dishonouring it writes a reversal in the ledger.' : 'Mark this payment as bounced / not received.'}
        label="Reason"
        required
        destructive
        confirmLabel="Dishonour"
        describeError={staffPaymentError}
        onConfirm={async (reason) => {
          await dishonour.mutateAsync({ paymentId: p.payment_id, reason })
          setNotice('Payment dishonoured.')
        }}
      />
      <ReasonDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Cancel payment"
        description="Only recorded or deposited payments can be cancelled."
        label="Reason"
        required
        destructive
        confirmLabel="Cancel payment"
        describeError={staffPaymentError}
        onConfirm={async (reason) => {
          await cancel.mutateAsync({ paymentId: p.payment_id, reason })
          setNotice('Payment cancelled.')
        }}
      />
    </div>
  )
}

function PaymentDetailLoader({ id, canAct, isAdmin }: { id: number; canAct: boolean; isAdmin: boolean }) {
  const { data, isLoading, error, refetch } = usePaymentDetail(id)
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-40 w-full" /></div>
  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (!data) return null
  return <PaymentDetailView p={data} canAct={canAct} isAdmin={isAdmin} />
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can, isLoaded } = usePermissions()
  if (!isLoaded) return <div className="p-8"><Skeleton className="h-8 w-48" /></div>
  if (!can('payments.view_all')) return <NoAccess what="Payments" />
  return (
    <div className="space-y-4 p-6 md:p-8">
      <Link href="/dashboard/accounts" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0e2a63]"><ArrowLeft className="h-4 w-4" /> Accounts</Link>
      <PaymentDetailLoader id={Number(id)} canAct={can('payments.process')} isAdmin={can('payments.segregation_override')} />
    </div>
  )
}
