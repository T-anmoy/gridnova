'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import ReasonDialog from '@/components/dashboard/ReasonDialog'
import { useCancelStaffPayment, useDepositPayment, useDishonourPayment, useVerifyPayment } from '@/lib/dashboard/accounts-api-client'
import { SELF_VERIFICATION_TEXT, isSelfVerification, staffPaymentError } from '@/lib/dashboard/payment-ui'
import type { StaffPayment } from '@/lib/associate/payment-types'

const INSTRUMENT_MODES = ['cheque', 'demand_draft']

/**
 * Deposit / verify / dishonour / cancel for one payment, with their dialogs — the same on an
 * associate customer's payment (Accounts payment page) and a direct customer's (lead Payments tab).
 * The caller decides who may act (`payments.process`); `isAdmin` is `payments.segregation_override`.
 *
 * Nobody verifies a payment they recorded: when `recorded_by` is the signed-in person the rule is
 * said up front; the server's 409 `self_verification` is still the authority.
 */
export default function PaymentActions({ p, isAdmin }: { p: StaffPayment; isAdmin: boolean }) {
  const { userId } = useAuth()
  const deposit = useDepositPayment()
  const verify = useVerifyPayment()
  const dishonour = useDishonourPayment()
  const cancel = useCancelStaffPayment()
  const [dialog, setDialog] = useState<'verify' | 'dishonour' | 'cancel' | null>(null)
  const [selfConflict, setSelfConflict] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const open = p.status === 'recorded' || p.status === 'deposited'
  const canDeposit = p.status === 'recorded' && INSTRUMENT_MODES.includes(p.mode)
  const canDishonour = open || p.status === 'verified'
  const ownRecord = !!userId && p.recorded_by === userId
  const self = selfConflict || ownRecord

  async function act(run: () => Promise<unknown>, ok: string) {
    setNotice(null)
    try {
      await run()
      setNotice(ok)
    } catch (err) {
      setNotice(staffPaymentError(err))
    }
  }

  if (!open && !canDishonour) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" data-testid="payment-actions">
        {canDeposit && <Button variant="outline" disabled={deposit.isPending} onClick={() => void act(() => deposit.mutateAsync({ paymentId: p.payment_id }), 'Marked as deposited.')}>Mark deposited</Button>}
        {open && <Button disabled={self && !isAdmin} onClick={() => { setSelfConflict(false); setDialog('verify') }}>Verify</Button>}
        {canDishonour && <Button variant="outline" onClick={() => setDialog('dishonour')}>Dishonour</Button>}
        {open && <Button variant="outline" onClick={() => setDialog('cancel')}>Cancel payment</Button>}
      </div>
      {open && self && (
        <p className="text-xs text-gray-600" data-testid="self-verification-note">
          {SELF_VERIFICATION_TEXT}{isAdmin ? ' As an Admin you may still verify it, with a reason.' : ''}
        </p>
      )}
      {notice && <p role="status" className="rounded-lg border border-[#e4e8ee] bg-white px-4 py-2 text-sm text-gray-700">{notice}</p>}

      <ReasonDialog
        open={dialog === 'verify'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Verify payment"
        description={
          self && !isAdmin
            ? SELF_VERIFICATION_TEXT
            : self
              ? `${SELF_VERIFICATION_TEXT} As an Admin you can still verify it, but you must give a reason.`
              : 'Verifying confirms the money has reached Grid Nova’s bank account. It writes the ledger entry and issues the receipt.'
        }
        label={self && isAdmin ? 'Reason (required)' : 'Note (optional)'}
        required={self && isAdmin}
        confirmDisabled={self && !isAdmin}
        confirmLabel={self && isAdmin ? 'Verify as admin' : 'Verify'}
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
        description={p.status === 'verified' ? 'This payment is already verified: dishonouring it writes a reversal in the ledger and voids its receipt.' : 'Mark this payment as bounced / not received.'}
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
