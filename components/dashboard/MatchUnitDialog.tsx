'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CataloguePicker, { type CatalogueItem } from '@/components/execution/CataloguePicker'
import { useMatchUnit, useStaffCatalogue } from '@/lib/dashboard/register-api-client'
import { REGISTER_ERRORS, registerErrorMessage } from '@/lib/dashboard/register-errors'
import type { StaffRegisterUnit } from '@/lib/dashboard/register-staff-types'

const field = 'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-3 py-2 text-sm outline-none focus:border-[#2f5daa]'

/**
 * Match an unmatched unit to a catalogue item. `locked` is true once the register
 * is verified: then only an Admin may match, and a reason is required (the field
 * appears only in that case). The server decides every consistency rule — category,
 * DCR, active — and its answer is shown in plain words.
 */
export default function MatchUnitDialog({ onboardingId, unit, locked, onClose }: { onboardingId: number; unit: StaffRegisterUnit; locked: boolean; onClose: () => void }) {
  const match = useMatchUnit(onboardingId)
  // Only modules and inverters are ever matched; `other` never reaches this dialog.
  const catalogue = useStaffCatalogue(unit.category === 'inverter' ? 'inverter' : 'module')
  const [picked, setPicked] = useState<CatalogueItem | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setError(null)
    if (!picked) return setError('Choose a catalogue item.')
    if (locked && !reason.trim()) return setError(REGISTER_ERRORS.reason_required)
    setBusy(true)
    try {
      await match.mutateAsync({ unitId: unit.unit_id, equipmentId: picked.id, ...(locked ? { reason: reason.trim() } : {}) })
      onClose()
    } catch (err) {
      setError(registerErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const printed = [unit.brand_as_printed, unit.model_as_printed].filter(Boolean).join(' ')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Match {unit.serial_number}</DialogTitle>
          <DialogDescription>
            The associate entered this {unit.category} as printed on the nameplate{printed ? `: ${printed}` : ''}.
            {unit.category === 'module' && unit.is_dcr != null ? ` They declared it ${unit.is_dcr ? 'DCR' : 'non-DCR'}.` : ''} Pick the catalogue item it is — the printed text stays on the unit as the record of what was declared.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <CataloguePicker id={`match-${unit.unit_id}`} label="Catalogue item" value={picked?.id ?? null} onChange={setPicked} source={catalogue} />
          {locked && (
            <div>
              <label htmlFor="match-reason" className="mb-1.5 block text-xs uppercase tracking-[0.1em] text-gray-500">Reason (required — the register is verified) *</label>
              <input id="match-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-red-600" data-testid="match-error">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !picked || (locked && !reason.trim())} onClick={() => void save()}>Match unit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
