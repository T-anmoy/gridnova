'use client'

import { useId, useMemo } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEquipment } from '@/lib/dashboard/api-client'
import { fieldAnchorId, type FieldErrors } from '@/lib/proposals/document-logic'
import type { BoqRow } from '@/lib/proposals/document-types'
import { CONTROL, FieldError, TextField } from './fields'

// The server accepts a make when each `/`-separated name is an active catalogue
// brand, a price-list make, a default-row make, or one of its fixed words. Only
// the catalogue is readable from the dashboard, so it is offered as suggestions
// and anything else is left for the server to judge (422 make_not_in_catalogue).
export const EQUIVALENT = 'Equivalent'

const SEP = ' / '

export function splitMake(make: string): string[] {
  return make
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function hasEquivalent(make: string): boolean {
  return splitMake(make).some((p) => p.toLowerCase() === EQUIVALENT.toLowerCase())
}

export function withEquivalent(make: string, on: boolean): string {
  const parts = splitMake(make).filter((p) => p.toLowerCase() !== EQUIVALENT.toLowerCase())
  return (on ? [...parts, EQUIVALENT] : parts).join(SEP)
}

export function addMake(make: string, brand: string): string {
  const parts = splitMake(make)
  if (parts.some((p) => p.toLowerCase() === brand.toLowerCase())) return make
  const eq = hasEquivalent(make)
  const names = parts.filter((p) => p.toLowerCase() !== EQUIVALENT.toLowerCase())
  return [...names, brand, ...(eq ? [EQUIVALENT] : [])].join(SEP)
}

const KINDS = [
  { value: '', label: 'Other row' },
  { value: 'module', label: 'Modules' },
  { value: 'inverter', label: 'Inverter' },
  { value: 'cable', label: 'Cable' },
]

const EMPTY_ROW: BoqRow = { description: '', quantity: '', standard: null, make: '', kind: null }

export function BoqEditor({ value, onChange, editable, errors }: { value: BoqRow[]; onChange: (v: BoqRow[]) => void; editable: boolean; errors: FieldErrors }) {
  const listId = useId()
  // Read by every staff role; only brands are used (never the procurement price).
  const { data: equipment, isError } = useEquipment(editable ? { is_active: true } : undefined)
  const brands = useMemo(
    () => [...new Set((equipment ?? []).filter((e) => e.is_active && !e.is_placeholder).map((e) => e.brand.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [equipment],
  )
  const set = (i: number, p: Partial<BoqRow>) => onChange(value.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...value]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }

  return (
    <div id={fieldAnchorId('boq')} tabIndex={-1} className="space-y-3 outline-none">
      {editable && (
        <datalist id={listId}>
          {brands.map((b) => (
            <option key={b} value={b} />
          ))}
          <option value={EQUIVALENT} />
        </datalist>
      )}
      {editable && isError && <p className="font-utility text-xs text-amber-700">The equipment catalogue could not be loaded — type the make; the server checks it on save.</p>}
      <ol className="space-y-3">
        {value.map((row, i) => (
          <li key={i} className="rounded-lg border border-[#e4e8ee] p-3" data-testid="boq-row">
            <p className="mb-2 font-utility text-xs font-semibold text-[#111827]/60">Row {i + 1}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField field={`boq[${i}].description`} label="Description" value={row.description} onChange={(v) => set(i, { description: v })} editable={editable} errors={errors} maxLength={160} tokens />
              <TextField field={`boq[${i}].quantity`} label="Quantity" value={row.quantity} onChange={(v) => set(i, { quantity: v })} editable={editable} errors={errors} maxLength={60} tokens hint="Free text, e.g. “{capacity_kwp} kWp” or “1 set”." />
              <div className="sm:col-span-2">
                <label htmlFor={fieldAnchorId(`boq[${i}].make`)} className="mb-1 block font-utility text-xs font-medium text-[#111827]/75">
                  Make
                </label>
                <input
                  id={fieldAnchorId(`boq[${i}].make`)}
                  className={CONTROL}
                  list={editable ? listId : undefined}
                  value={row.make}
                  disabled={!editable}
                  maxLength={160}
                  aria-invalid={errors[`boq[${i}].make`] ? true : undefined}
                  aria-describedby={errors[`boq[${i}].make`] ? `${fieldAnchorId(`boq[${i}].make`)}-error` : undefined}
                  onChange={(e) => set(i, { make: e.target.value })}
                />
                {editable && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {brands.length > 0 && (
                      <select
                        aria-label={`Add a catalogue make to row ${i + 1}`}
                        className={`${CONTROL} w-auto`}
                        value=""
                        onChange={(e) => e.target.value && set(i, { make: addMake(row.make, e.target.value) })}
                      >
                        <option value="">Add from catalogue…</option>
                        {brands.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="flex min-h-11 items-center gap-2 font-utility text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-[#0e2a63]" checked={hasEquivalent(row.make)} onChange={(e) => set(i, { make: withEquivalent(row.make, e.target.checked) })} />
                      or equivalent
                    </label>
                  </div>
                )}
                <FieldError field={`boq[${i}].make`} errors={errors} />
              </div>
              <TextField field={`boq[${i}].standard`} label="Standard (optional)" value={row.standard} onChange={(v) => set(i, { standard: v })} editable={editable} errors={errors} maxLength={60} />
              <div>
                <label htmlFor={fieldAnchorId(`boq[${i}].kind`)} className="mb-1 block font-utility text-xs font-medium text-[#111827]/75">
                  Row type
                </label>
                <select id={fieldAnchorId(`boq[${i}].kind`)} className={CONTROL} value={row.kind ?? ''} disabled={!editable} onChange={(e) => set(i, { kind: (e.target.value || null) as BoqRow['kind'] })}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {editable && (
              <div className="mt-2 flex justify-end gap-1">
                <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={i === 0} aria-label={`Move row ${i + 1} up`} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={i === value.length - 1} aria-label={`Move row ${i + 1} down`} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-label={`Remove row ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {editable && value.length < 30 && (
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onChange([...value, { ...EMPTY_ROW }])}>
          <Plus className="mr-1 h-4 w-4" /> Add row
        </Button>
      )}
      <FieldError field="boq" errors={errors} />
    </div>
  )
}
