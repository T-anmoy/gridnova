'use client'

import { useState } from 'react'
import { clearAutosaveDraft, useAutosaveDraft } from '@/lib/associate/useAutosaveDraft'
import { Loader2 } from 'lucide-react'
import ProofUpload from '@/components/payments/ProofUpload'
import { paymentErrorMessage, type PaymentCopy } from '@/components/payments/payment-errors'
import { humanize } from '@/lib/associate/execution-labels'
import { isAmountShapeValid } from '@/lib/money'
import { useMilestoneLabel } from '@/lib/pricing/useMilestoneLabel'
import type { Milestone, Payment, RecordPaymentInput } from '@/lib/associate/payment-types'
import DateField from '@/components/forms/DateField'

// Modes that are written on a physical instrument and so need its bank and date.
const INSTRUMENT_MODES = ['cheque', 'demand_draft']

const field =
  'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-4 py-3 text-[#111827] text-sm font-utility outline-none focus-visible:border-[#2f5daa] focus-visible:ring-2 focus-visible:ring-[#2f5daa]/25'
const label = 'mb-1.5 block font-utility text-xs uppercase tracking-[0.1em] text-[#111827]/65'

const EMPTY = { mode: '', amount: '', reference: '', bank_name: '', instrument_date: '', payer_name: '', milestone_id: '' }

/**
 * Record a customer payment (associate portal and staff share this form). The
 * payment methods are exactly the backend's `enabled_modes` — there is no cash.
 * The amount is sent as the string that was typed; the browser never parses it.
 * Right after a payment is recorded the form asks for proof, because Grid Nova
 * can't verify an associate-recorded payment without it.
 */
export default function RecordPaymentForm({
  copy,
  idPrefix,
  modes,
  milestones,
  defaultPayerName,
  onRecord,
  onUploadProof,
}: {
  copy: PaymentCopy
  idPrefix: string
  modes: string[]
  milestones: Milestone[]
  defaultPayerName?: string
  onRecord: (input: RecordPaymentInput) => Promise<Payment>
  onUploadProof: (paymentId: number, file: File, onProgress: (percent: number) => void) => Promise<unknown>
}) {
  const milestoneLabel = useMilestoneLabel()
  // A half-filled form survives a refresh or a back-press (this device only).
  const draftKey = `gna-payment-form-${idPrefix}`
  const [v, setV] = useAutosaveDraft(draftKey, { ...EMPTY, payer_name: defaultPayerName ?? '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [recorded, setRecorded] = useState<Payment | null>(null)
  const set = (k: keyof typeof EMPTY, value: string) => {
    setV((s) => ({ ...s, [k]: value }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const needsInstrument = INSTRUMENT_MODES.includes(v.mode)

  function validate() {
    const next: Record<string, string> = {}
    if (!v.mode) next.mode = copy.required
    if (!isAmountShapeValid(v.amount)) next.amount = copy.amountError
    if (!v.reference.trim()) next.reference = copy.required
    if (needsInstrument && !v.bank_name.trim()) next.bank_name = copy.required
    if (needsInstrument && !v.instrument_date) next.instrument_date = copy.required
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    setFormError(null)
    if (!validate()) return
    setSaving(true)
    try {
      const payment = await onRecord({
        amount: v.amount.trim(),
        mode: v.mode,
        reference: v.reference.trim(),
        ...(v.bank_name.trim() ? { bank_name: v.bank_name.trim() } : {}),
        ...(needsInstrument && v.instrument_date ? { instrument_date: v.instrument_date } : {}),
        ...(v.payer_name.trim() ? { payer_name: v.payer_name.trim() } : {}),
        ...(v.milestone_id ? { milestone_id: Number(v.milestone_id) } : {}),
      })
      clearAutosaveDraft(draftKey)
      setRecorded(payment)
    } catch (err) {
      setFormError(paymentErrorMessage(err, copy))
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setRecorded(null)
    setV({ ...EMPTY, payer_name: v.payer_name })
  }

  if (recorded) {
    return (
      <div className="space-y-3" data-testid="proof-prompt">
        <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.proofTitle}</p>
        <p className="text-sm text-[#111827]/70">{copy.proofBody}</p>
        <ProofUpload copy={copy} paymentId={recorded.payment_id} upload={onUploadProof} startOpen />
        <button type="button" onClick={reset} className="min-h-[44px] font-utility text-sm font-semibold text-[#0e2a63] underline">
          {copy.proofSkip}
        </button>
      </div>
    )
  }

  const err = (k: string) => (errors[k] ? <p className="mt-1.5 text-[11px] text-red-500 font-utility">{errors[k]}</p> : null)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSave()
      }}
    >
      <p className="font-display text-base font-semibold text-[#0e2a63]">{copy.recordTitle}</p>
      <div>
        <label htmlFor={`${idPrefix}-mode`} className={label}>{copy.mode}</label>
        <select id={`${idPrefix}-mode`} className={field} value={v.mode} onChange={(e) => set('mode', e.target.value)}>
          <option value="" />
          {modes.map((m) => (
            <option key={m} value={m}>{copy.modes[m as keyof PaymentCopy['modes']] ?? humanize(m)}</option>
          ))}
        </select>
        {err('mode')}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-amount`} className={label}>{copy.amount}</label>
        <input id={`${idPrefix}-amount`} className={field} inputMode="decimal" autoComplete="off" value={v.amount} onChange={(e) => set('amount', e.target.value)} />
        <p className="mt-1 text-[11px] text-[#111827]/65 font-utility">{copy.amountHint}</p>
        {err('amount')}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-reference`} className={label}>{copy.reference}</label>
        <input id={`${idPrefix}-reference`} className={field} autoComplete="off" value={v.reference} onChange={(e) => set('reference', e.target.value)} />
        {err('reference')}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-bank`} className={label}>
          {copy.bankName} ({needsInstrument ? copy.required : copy.optional})
        </label>
        <input id={`${idPrefix}-bank`} className={field} value={v.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
        {err('bank_name')}
      </div>
      {needsInstrument && (
        <div>
          <label htmlFor={`${idPrefix}-date`} className={label}>{copy.instrumentDate}</label>
          <DateField id={`${idPrefix}-date`} label={copy.instrumentDate} value={v.instrument_date} onChange={(d) => set('instrument_date', d)} />
          {err('instrument_date')}
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-payer`} className={label}>{copy.payerName}</label>
        <input id={`${idPrefix}-payer`} className={field} value={v.payer_name} onChange={(e) => set('payer_name', e.target.value)} />
      </div>
      {milestones.length > 0 && (
        <div>
          <label htmlFor={`${idPrefix}-milestone`} className={label}>{copy.milestone}</label>
          <select id={`${idPrefix}-milestone`} className={field} value={v.milestone_id} onChange={(e) => set('milestone_id', e.target.value)}>
            <option value="">{copy.milestoneNone}</option>
            {milestones.map((m) => (
              <option key={m.milestone_id} value={m.milestone_id}>{milestoneLabel(m.label)}</option>
            ))}
          </select>
        </div>
      )}
      {formError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? copy.saving : copy.save}
      </button>
    </form>
  )
}
