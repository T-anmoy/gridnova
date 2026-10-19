'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CataloguePicker, { type CatalogueItem } from '@/components/execution/CataloguePicker'
import { useCreateCatalogueItem, useMatchUnit, useStaffCatalogue } from '@/lib/dashboard/register-api-client'
import { ApiError } from '@/lib/dashboard/api-error'
import type { EquipmentCategory } from '@/lib/dashboard/types'
import { REGISTER_ERRORS, registerErrorMessage } from '@/lib/dashboard/register-errors'
import type { StaffRegisterUnit } from '@/lib/dashboard/register-staff-types'

const label = 'mb-1.5 block text-xs uppercase tracking-[0.1em] text-gray-500'
// A unit is only ever matched to an item of its own kind (the server answers
// equipment_category_mismatch otherwise), so the add-model form is locked to
// that category rather than offering all four EquipmentCategory values.
const CATEGORY_LABEL: Partial<Record<EquipmentCategory, string>> = { module: 'Module', inverter: 'Inverter' }
const field = 'w-full min-h-[44px] rounded-xl border border-[#e4e8ee] bg-white px-3 py-2 text-sm outline-none focus-visible:border-[#2f5daa] focus-visible:ring-2 focus-visible:ring-[#2f5daa]/25'

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

  // "Add this model to the catalogue": create the item, then match the unit to it.
  const create = useCreateCatalogueItem(onboardingId)
  const [adding, setAdding] = useState(false)
  const category: EquipmentCategory = unit.category === 'inverter' ? 'inverter' : 'module'
  const [brand, setBrand] = useState(unit.brand_as_printed ?? '')
  const [model, setModel] = useState(unit.model_as_printed ?? '')
  const [spec, setSpec] = useState('')
  const [dcr, setDcr] = useState<'' | 'yes' | 'no'>(unit.category === 'module' && unit.is_dcr != null ? (unit.is_dcr ? 'yes' : 'no') : '')
  const [needsEquivalent, setNeedsEquivalent] = useState(false)
  const [equivalentReason, setEquivalentReason] = useState('')
  // Once the item exists, a retry after a refused match must not create it again.
  const [createdId, setCreatedId] = useState<number | null>(null)

  async function addAndMatch() {
    setError(null)
    if (locked && !reason.trim()) return setError(REGISTER_ERRORS.reason_required)
    if (createdId == null && (!brand.trim() || !model.trim() || !dcr)) return setError('Enter the brand and model, and say whether it is DCR.')
    setBusy(true)
    try {
      let equipmentId = createdId
      if (equipmentId == null) {
        try {
          const made = await create.mutateAsync({
            category,
            brand: brand.trim(),
            model_name: model.trim(),
            ...(spec.trim() ? { specification: spec.trim() } : {}),
            is_dcr_compliant: dcr === 'yes',
            ...(needsEquivalent && equivalentReason.trim() ? { equivalent_reason: equivalentReason.trim() } : {}),
          })
          equipmentId = made.equipment.id
          setCreatedId(equipmentId)
        } catch (err) {
          if (err instanceof ApiError && err.structuredDetail?.code === 'make_not_approved') setNeedsEquivalent(true)
          throw err
        }
      }
      await match.mutateAsync({ unitId: unit.unit_id, equipmentId, ...(locked ? { reason: reason.trim() } : {}) })
      onClose()
    } catch (err) {
      setError(registerErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

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
          {!adding && <CataloguePicker id={`match-${unit.unit_id}`} label="Catalogue item" value={picked?.id ?? null} onChange={setPicked} source={catalogue} />}
          {!adding ? (
            <button type="button" className="min-h-[44px] text-sm font-semibold text-[#2f5daa] underline" onClick={() => { setAdding(true); setError(null) }}>
              Add this model to the catalogue
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-[#e4e8ee] p-3" data-testid="add-catalogue-form">
              <p className="text-sm font-semibold">Add this model to the catalogue</p>
              <div>
                <label htmlFor="cat-category" className={label}>Category *</label>
                <select id="cat-category" className={field} value={category} disabled aria-describedby="cat-category-note">
                  <option value={category}>{CATEGORY_LABEL[category]}</option>
                </select>
                <p id="cat-category-note" className="mt-1 text-xs text-gray-500">Fixed to this unit’s kind — a unit can only be matched to an item of the same kind.</p>
              </div>
              <div>
                <label htmlFor="cat-brand" className={label}>Brand *</label>
                <input id="cat-brand" className={field} value={brand} disabled={createdId != null} onChange={(e) => setBrand(e.target.value)} maxLength={100} />
              </div>
              <div>
                <label htmlFor="cat-model" className={label}>Model, as printed *</label>
                <input id="cat-model" className={field} value={model} disabled={createdId != null} onChange={(e) => setModel(e.target.value)} maxLength={100} />
              </div>
              <div>
                <label htmlFor="cat-spec" className={label}>Specification</label>
                <textarea id="cat-spec" className={field} rows={2} value={spec} disabled={createdId != null} onChange={(e) => setSpec(e.target.value)} maxLength={2000} />
              </div>
              <div>
                <label htmlFor="cat-dcr" className={label}>DCR (from the maker’s declaration) *</label>
                <select id="cat-dcr" className={field} value={dcr} disabled={createdId != null} onChange={(e) => setDcr(e.target.value as '' | 'yes' | 'no')}>
                  <option value="">Select…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {needsEquivalent && (
                <div>
                  <label htmlFor="cat-equivalent" className={label}>Why is this make acceptable as an equivalent? *</label>
                  <textarea id="cat-equivalent" className={field} rows={2} value={equivalentReason} onChange={(e) => setEquivalentReason(e.target.value)} maxLength={2000} />
                </div>
              )}
              <button type="button" className="min-h-[44px] text-sm underline" disabled={createdId != null} onClick={() => { setAdding(false); setNeedsEquivalent(false); setError(null) }}>
                Pick from the catalogue instead
              </button>
            </div>
          )}
          {locked && (
            <div>
              <label htmlFor="match-reason" className={label}>Reason (required — the register is verified) *</label>
              <input id="match-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-red-600" data-testid="match-error">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {adding ? (
            <Button disabled={busy || (locked && !reason.trim())} onClick={() => void addAndMatch()}>Add to catalogue and match</Button>
          ) : (
            <Button disabled={busy || !picked || (locked && !reason.trim())} onClick={() => void save()}>Match unit</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
