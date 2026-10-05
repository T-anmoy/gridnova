'use client'

import RecordPaymentForm from '@/components/payments/RecordPaymentForm'
import { STAFF_PAYMENT_COPY } from '@/lib/dashboard/staff-copy'
import { useRecordStaffPayment, useUploadStaffPaymentProof } from '@/lib/dashboard/payments-api-client'
import type { Milestone } from '@/lib/associate/payment-types'

// Staff (admin / accounts / sales) recording a payment on a customer's behalf.
// Same form and rules as the portal — modes come from the backend, no cash.
// The caller decides who may see this (see canRecordPayments).
export default function StaffRecordPayment({
  onboardingId,
  modes,
  milestones,
  defaultPayerName,
}: {
  onboardingId: number
  modes: string[]
  milestones: Milestone[]
  defaultPayerName?: string
}) {
  const record = useRecordStaffPayment(onboardingId)
  const upload = useUploadStaffPaymentProof(onboardingId)
  return (
    <RecordPaymentForm
      copy={STAFF_PAYMENT_COPY}
      idPrefix={`staff-pay-${onboardingId}`}
      modes={modes}
      milestones={milestones}
      defaultPayerName={defaultPayerName}
      onRecord={(input) => record.mutateAsync(input)}
      onUploadProof={(paymentId, file, onProgress) => upload.mutateAsync({ paymentId, file, onProgress })}
    />
  )
}
