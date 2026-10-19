'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAssociateUpdateUnit, useAssociateVoidUnit } from '@/lib/associate/register-api-client'
import { entryErrorOf } from '@/lib/associate/register-entry'
import type { RegisterUnit } from '@/lib/associate/register-types'
import type { Messages } from '@/lib/i18n/types'

type RegisterCopy = Messages['associates']['portal']['execution']['register']

const field = 'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-3 py-2 text-base focus:border-[#2f5daa] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa]'
const lbl = 'mb-1.5 block text-xs uppercase tracking-[0.1em] text-[#111827]/65'
const btn = 'inline-flex min-h-[44px] items-center rounded-lg border border-[#e4e8ee] px-3 text-sm font-semibold text-[#0e2a63] disabled:opacity-50'
const fill = (t: string, vars: Record<string, string>) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t)

function EditDialog({ onboardingId, unit, copy, onClose }: { onboardingId: number; unit: RegisterUnit; copy: RegisterCopy; onClose: () => void }) {
  const entry = copy.entry
  const update = useAssociateUpdateUnit(onboardingId)
  const unlisted = unit.category !== 'other' && unit.equipment == null
  const [serial, setSerial] = useState(unit.serial_number)
  const [rating, setRating] = useState((unit.category === 'module' ? unit.rating_wp : unit.rating_kw) ?? '')
  const [brand, setBrand] = useState(unit.brand_as_printed ?? '')
  const [model, setModel] = useState(unit.model_as_printed ?? '')
  const [dcr, setDcr] = useState<'yes' | 'no' | ''>(unit.is_dcr == null ? '' : unit.is_dcr ? 'yes' : 'no')
  const [start, setStart] = useState(unit.warranty_start ?? '')
  const [end, setEnd] = useState(unit.warranty_end ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setError(null)
    if (!!start !== !!end) return setError(entry.validation.warrantyPair)
    if (!serial.trim()) return setError(entry.validation.serialRequired)
    if (unit.category !== 'other' && !rating.trim()) return setError(entry.validation.ratingRequired)
    if (unlisted && !brand.trim()) return setError(entry.validation.brandRequired)
    if (unlisted && !model.trim()) return setError(entry.validation.modelPrintedRequired)
    if (unlisted && unit.category === 'module' && !dcr) return setError(entry.validation.dcrRequired)
    setBusy(true)
    try {
      await update.mutateAsync({
        unitId: unit.unit_id,
        patch: {
          serial_number: serial.trim(),
          ...(unit.category === 'module' ? { rating_wp: rating.trim() } : unit.category === 'inverter' ? { rating_kw: rating.trim() } : {}),
          ...(unlisted ? { brand_as_printed: brand.trim(), model_as_printed: model.trim() } : {}),
          ...(unlisted && unit.category === 'module' ? { is_dcr: dcr === 'yes' } : {}),
          ...(start && end ? { warranty_start: start, warranty_end: end } : {}),
        },
      })
      onClose()
    } catch (err) {
      setError(entryErrorOf(err, entry.errors))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{fill(entry.editTitle, { serial: unit.serial_number })}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label htmlFor="edit-serial" className={lbl}>{entry.serial}</label><input id="edit-serial" className={field} value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
          {unit.category !== 'other' && (
            <div>
              <label htmlFor="edit-rating" className={lbl}>{unit.category === 'module' ? entry.ratingWp : entry.ratingKw}</label>
              <input id="edit-rating" className={field} inputMode="decimal" value={rating} onChange={(e) => setRating(e.target.value)} />
            </div>
          )}
          {unlisted && (
            <>
              <div><label htmlFor="edit-brand" className={lbl}>{entry.brandPrinted}</label><input id="edit-brand" className={field} maxLength={100} value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
              <div><label htmlFor="edit-model" className={lbl}>{entry.modelPrinted}</label><input id="edit-model" className={field} maxLength={100} value={model} onChange={(e) => setModel(e.target.value)} /></div>
              {unit.category === 'module' && (
                <fieldset>
                  <legend className={lbl}>{entry.dcrQuestion}</legend>
                  <div className="flex gap-2">
                    {(['yes', 'no'] as const).map((v) => (
                      <button key={v} type="button" aria-pressed={dcr === v} onClick={() => setDcr(v)} className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${dcr === v ? 'border-[#0e2a63] bg-[#0e2a63] text-white' : 'border-[#e4e8ee] text-[#0e2a63]'}`}>
                        {v === 'yes' ? entry.dcrYes : entry.dcrNo}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="edit-ws" className={lbl}>{entry.warrantyStart}</label><input id="edit-ws" type="date" className={field} value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label htmlFor="edit-we" className={lbl}>{entry.warrantyEnd}</label><input id="edit-we" type="date" className={field} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <button type="button" className={btn} onClick={onClose}>{entry.cancel}</button>
          <button type="button" className={`${btn} bg-[#0e2a63] text-white`} disabled={busy} onClick={() => void save()}>{entry.saveChanges}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VoidDialog({ onboardingId, unit, copy, onClose }: { onboardingId: number; unit: RegisterUnit; copy: RegisterCopy; onClose: () => void }) {
  const entry = copy.entry
  const voidUnit = useAssociateVoidUnit(onboardingId)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function confirm() {
    setError(null)
    if (!reason.trim()) return setError(entry.validation.reasonRequired)
    setBusy(true)
    try {
      await voidUnit.mutateAsync({ unitId: unit.unit_id, reason: reason.trim() })
      onClose()
    } catch (err) {
      setError(entryErrorOf(err, entry.errors))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{fill(entry.voidTitle, { serial: unit.serial_number })}</DialogTitle></DialogHeader>
        <p className="text-sm text-[#111827]/70">{entry.voidBody}</p>
        <div><label htmlFor="void-reason" className={lbl}>{entry.reasonLabel} *</label><input id="void-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <button type="button" className={btn} onClick={onClose}>{entry.cancel}</button>
          <button type="button" className={`${btn} bg-red-700 text-white`} disabled={busy} onClick={() => void confirm()}>{entry.voidConfirm}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Edit and remove for one unit, shown only while the register is not yet verified. */
export default function RegisterUnitActions({ onboardingId, unit, copy }: { onboardingId: number; unit: RegisterUnit; copy: RegisterCopy }) {
  const [mode, setMode] = useState<'edit' | 'void' | null>(null)
  return (
    <>
      <div className="flex gap-2 pt-1">
        <button type="button" className={btn} onClick={() => setMode('edit')}>{copy.entry.edit}</button>
        <button type="button" className={btn} onClick={() => setMode('void')}>{copy.entry.void}</button>
      </div>
      {mode === 'edit' && <EditDialog onboardingId={onboardingId} unit={unit} copy={copy} onClose={() => setMode(null)} />}
      {mode === 'void' && <VoidDialog onboardingId={onboardingId} unit={unit} copy={copy} onClose={() => setMode(null)} />}
    </>
  )
}
