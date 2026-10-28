'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardError } from '@/components/dashboard/DashboardError'
import PaymentScheduleEditor from '@/components/dashboard/PaymentScheduleEditor'
import StaffRecordPayment from '@/components/dashboard/StaffRecordPayment'
import { canRecordPayments, canSeePayments, useStaffOnboardingPayments } from '@/lib/dashboard/payments-api-client'
import { ATTENTION_LABEL, STATUS_LABEL, STATUS_VARIANT, staffModeLabel } from '@/lib/dashboard/payment-ui'
import { formatDate } from '@/lib/dashboard/utils'
import { formatInr } from '@/lib/money'
import { usePermissions } from '@/lib/access/use-permissions'

/**
 * Payments on the customer page: totals, instalments (as the server returns
 * them), payments with status / attention chips, the schedule editor and the
 * record form. Rendered only for people who may see payments — Operations and
 * engineers never reach this component, so no payment request is ever made for them.
 */
function PaymentsBody({ onboardingId }: { onboardingId: number }) {
  const { can } = usePermissions()
  const { data, isLoading, error, refetch } = useStaffOnboardingPayments(onboardingId)
  const canEditSchedule = can('payments.process')

  if (isLoading) return <Card><CardContent className="space-y-3 p-6"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /></CardContent></Card>
  if (error) return <DashboardError error={error} onRetry={() => void refetch()} />
  if (!data) return null

  const locked = data.payments.some((p) => p.status !== 'cancelled')
  // The accounts payment page is for people who see every customer's payments; sales see rows without that link.
  const linkToPayment = can('payments.view_all')

  return (
    <div className="space-y-4" data-testid="staff-payments-section">
      <Card>
        <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4" data-testid="payment-totals">
            <div><dt className="text-xs text-gray-500">Accepted total</dt><dd className="font-semibold">{formatInr(data.totals.accepted_total)}</dd></div>
            <div><dt className="text-xs text-gray-500">Verified</dt><dd className="font-semibold">{formatInr(data.totals.paid_verified)}</dd></div>
            <div><dt className="text-xs text-gray-500">Awaiting verification</dt><dd className="font-semibold">{formatInr(data.totals.awaiting_verification)}</dd></div>
            <div><dt className="text-xs text-gray-500">Balance</dt><dd className="font-semibold">{formatInr(data.totals.balance)}</dd></div>
          </dl>

          {data.payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-2" aria-label="Payments">
              {data.payments.map((p) => (
                <li key={p.payment_id} className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2 text-sm last:border-0" data-testid="section-payment">
                  <span className="font-medium">{formatInr(p.amount)}</span>
                  <Badge variant={STATUS_VARIANT[p.status] ?? 'gray'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                  <span className="text-gray-500">{staffModeLabel(p.mode)} · {p.reference} · {formatDate(p.recorded_at)}</span>
                  {p.previous_payment_id != null && <span className="text-xs text-gray-500">replaces bounced payment #{p.previous_payment_id}</span>}
                  {(p.attention_reasons ?? []).map((r) => <Badge key={r} variant="orange">{ATTENTION_LABEL[r] ?? r.replace(/_/g, ' ')}</Badge>)}
                  {linkToPayment && <Link className="ml-auto text-[#0e2a63] underline" href={`/dashboard/accounts/payments/${p.payment_id}`}>Open</Link>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment schedule</CardTitle></CardHeader>
        <CardContent>
          {data.milestones.length === 0 ? (
            <p className="text-sm text-gray-500">No schedule yet.</p>
          ) : (
            <PaymentScheduleEditor
              key={data.milestones.map((m) => `${m.milestone_id}:${m.label}:${m.percent}`).join('|')}
              onboardingId={onboardingId}
              milestones={data.milestones}
              locked={locked}
              canEdit={canEditSchedule}
            />
          )}
        </CardContent>
      </Card>

      {canRecordPayments(can) && (
        <Card>
          <CardContent className="p-6">
            <StaffRecordPayment onboardingId={onboardingId} modes={data.enabled_modes} milestones={data.milestones} defaultPayerName={data.project.customer_name} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function StaffPaymentsSection({ onboardingId }: { onboardingId: number }) {
  const { can } = usePermissions()
  if (!canSeePayments(can)) return null
  return <PaymentsBody onboardingId={onboardingId} />
}
