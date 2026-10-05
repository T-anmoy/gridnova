'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSavePaymentSchedule } from '@/lib/dashboard/accounts-api-client'
import { staffPaymentError } from '@/lib/dashboard/payment-ui'
import { formatInr } from '@/lib/money'
import type { Milestone } from '@/lib/associate/payment-types'

/**
 * Edit the instalment labels / percentages / triggers for one customer.
 * Everything comes from the API and goes back as returned — no label, percent or
 * trigger is hard-coded. The number of instalments can't change (they are never
 * deleted), the percentages must total 100 (the server checks it), and the
 * whole schedule is locked once any non-cancelled payment exists.
 * Amounts shown are the server's, read-only.
 */
export default function PaymentScheduleEditor({
  onboardingId,
  milestones,
  locked,
  canEdit,
}: {
  onboardingId: number
  milestones: Milestone[]
  locked: boolean
  canEdit: boolean
}) {
  const save = useSavePaymentSchedule(onboardingId)
  const [rows, setRows] = useState(() => milestones.map((m) => ({ label: m.label, percent: String(m.percent), trigger: m.trigger ?? '' })))
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const disabled = !canEdit || locked

  async function handleSave() {
    setMessage(null)
    try {
      await save.mutateAsync({ milestones: rows.map((r) => ({ label: r.label.trim(), percent: r.percent.trim(), trigger: r.trigger.trim() || null })) })
      setMessage({ ok: true, text: 'Schedule saved.' })
    } catch (err) {
      setMessage({ ok: false, text: staffPaymentError(err) })
    }
  }

  const set = (i: number, key: 'label' | 'percent' | 'trigger', value: string) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [key]: value } : r)))

  return (
    <div className="space-y-3" data-testid="schedule-editor">
      {locked && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="schedule-locked">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          The schedule is locked because payments have already been recorded for this customer.
        </p>
      )}
      <ul className="space-y-3">
        {milestones.map((m, i) => (
          <li key={m.milestone_id} className="grid gap-2 rounded-lg border border-[#e4e8ee] p-3 sm:grid-cols-[1fr_6rem_1fr_auto]">
            <label className="text-xs text-gray-500">
              Label
              <Input aria-label={`Instalment ${m.number} label`} disabled={disabled} value={rows[i].label} onChange={(e) => set(i, 'label', e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Percent
              <Input aria-label={`Instalment ${m.number} percent`} inputMode="decimal" disabled={disabled} value={rows[i].percent} onChange={(e) => set(i, 'percent', e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Falls due when
              <Input aria-label={`Instalment ${m.number} trigger`} disabled={disabled} value={rows[i].trigger} onChange={(e) => set(i, 'trigger', e.target.value)} />
            </label>
            <p className="self-end text-sm font-medium text-gray-800">{formatInr(m.amount_due)}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-400">The number of instalments can’t change. Percentages must total 100.</p>
      {canEdit && (
        <Button size="sm" disabled={disabled || save.isPending} onClick={() => void handleSave()}>
          Save schedule
        </Button>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
