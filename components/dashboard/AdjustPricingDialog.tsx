'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAdjustPricing } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import type { AdjustPricingInput } from '@/lib/dashboard/types'
import { isAmountShapeValid } from '@/lib/money'
import { documentError } from '@/lib/proposals/document-logic'

export type PriceInputKind = 'new_value' | 'basic_price' | 'rate_per_kwp'

// BE-13: adjust-pricing takes exactly ONE of these with the reason. Basic price
// and rate per kWp need a structured document (the backend computes GST and the
// total from them); the total including GST works on every proposal.
const KIND_LABEL: Record<PriceInputKind, { option: string; field: string; hint: string }> = {
  new_value: { option: 'Total including GST', field: 'New total value (₹) *', hint: 'The basic price and GST are worked out from this total.' },
  basic_price: { option: 'Basic price (before GST)', field: 'Basic price before GST (₹) *', hint: 'GST and the total are calculated by the system.' },
  rate_per_kwp: { option: 'Rate per kWp (before GST)', field: 'Rate per kWp before GST (₹) *', hint: 'Multiplied by the plant capacity to give the basic price.' },
}

export function buildAdjustPricingInput(proposalId: number, kind: PriceInputKind, raw: string, reason: string): AdjustPricingInput | string {
  const value = raw.trim()
  if (!reason.trim()) return 'A reason is required'
  if (kind === 'new_value') {
    const n = Number(value)
    // BE-22: a zero total is never a price (the API answers 422 for new_value <= 0).
    if (!value || !Number.isFinite(n) || n <= 0) return 'Enter a total above zero'
    return { proposalId, newValue: n, reason: reason.trim() }
  }
  if (!isAmountShapeValid(value) || Number(value) <= 0) return 'Enter an amount in rupees, up to 2 decimals'
  return kind === 'basic_price' ? { proposalId, basicPrice: value, reason: reason.trim() } : { proposalId, ratePerKwp: value, reason: reason.trim() }
}

export function AdjustPricingDialog({
  proposalId,
  open,
  onOpenChange,
  hasDocument,
  currentTotal,
}: {
  proposalId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  hasDocument: boolean
  currentTotal: number | null | undefined
}) {
  const mutation = useAdjustPricing()
  const [kind, setKind] = useState<PriceInputKind>('new_value')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const reset = () => {
    setKind('new_value')
    setAmount('')
    setReason('')
  }

  async function submit() {
    const input = buildAdjustPricingInput(proposalId, kind, amount, reason)
    if (typeof input === 'string') {
      toast.error(input)
      return
    }
    try {
      const result = await mutation.mutateAsync(input)
      toast.success(result.requires_manager_signoff ? 'Pricing updated — manager sign-off is now required' : 'Pricing updated')
      onOpenChange(false)
      reset()
    } catch (err) {
      const code = err instanceof ApiError ? err.structuredDetail?.code : undefined
      toast.error(code ? documentError(err).message : err instanceof ApiError ? err.detail || err.message : err instanceof Error ? err.message : 'Failed to adjust pricing')
    }
  }

  const label = KIND_LABEL[kind]
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Price</DialogTitle>
          <DialogDescription>
            {hasDocument ? 'Give one price — the total, the basic price or a rate per kWp — and the reason.' : 'Set a new total value for this proposal. The pricing section is rewritten to match.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {hasDocument && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Price to give</legend>
              <div className="space-y-1">
                {(Object.keys(KIND_LABEL) as PriceInputKind[]).map((k) => (
                  <label key={k} className="flex min-h-11 items-center gap-2 font-utility text-sm">
                    <input
                      type="radio"
                      name="price-kind"
                      value={k}
                      checked={kind === k}
                      className="h-4 w-4 accent-[#0e2a63]"
                      onChange={() => {
                        setKind(k)
                        setAmount('')
                      }}
                    />
                    {KIND_LABEL[k].option}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="adjust-price-amount">{label.field}</Label>
            <Input
              id="adjust-price-amount"
              type={kind === 'new_value' ? 'number' : 'text'}
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={kind === 'new_value' && currentTotal != null ? String(currentTotal) : undefined}
              aria-describedby="adjust-price-hint"
            />
            <p id="adjust-price-hint" className="font-utility text-xs text-[#111827]/60">
              {label.hint}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pricing-reason">Reason *</Label>
            <Textarea id="pricing-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is the price changing?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={mutation.isPending || !amount.trim() || !reason.trim()}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
