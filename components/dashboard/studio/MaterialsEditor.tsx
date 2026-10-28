'use client'

import { useMemo } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EQUIVALENT, addMake, splitMake } from '@/components/dashboard/proposal-document/BoqEditor'
import { cn } from '@/lib/dashboard/utils'
import { studioFieldId } from '@/lib/studio/logic'
import type { BoqRow } from '@/lib/proposals/document-types'
import type { StudioItem, StudioItemFigure, StudioOptions } from '@/lib/studio/types'
import { Money } from './ui'

// The bill of quantities (and, for itemised supply, the line items). Makes are PICKED, never
// typed: the list is the equipment catalogue's brands, the makes already on this proposal's
// rows (which the server generated from the price list), and "Equivalent".

const SMALL = 'w-full min-h-11 rounded-md border border-[#d5dbe4] bg-white px-2 py-1.5 text-sm font-utility outline-none focus-visible:ring-2 focus-visible:ring-[#f7a800]/60 disabled:bg-[#f7f9fc] aria-[invalid=true]:border-red-500'

/** "–": no make (an installation or service line); the server accepts it. */
export const NO_MAKE = '–'

/** Every make the picker offers: catalogue brands + makes already on the rows + Equivalent and "–". */
export function makeChoices(catalogue: string[], makesOnRows: string[]): string[] {
  const seen = new Map<string, string>()
  for (const m of [...catalogue, ...makesOnRows.flatMap(splitMake)]) {
    const key = m.trim().toLowerCase()
    if (key && key !== NO_MAKE && key !== EQUIVALENT.toLowerCase() && !seen.has(key)) seen.set(key, m.trim())
  }
  return [...[...seen.values()].sort((a, b) => a.localeCompare(b)), EQUIVALENT, NO_MAKE]
}

export function MakePicker({ field, value, choices, onChange, disabled, error, label }: { field: string; value: string; choices: string[]; onChange: (v: string) => void; disabled?: boolean; error?: string | null; label: string }) {
  const parts = splitMake(value)
  const left = choices.filter((c) => !parts.some((p) => p.toLowerCase() === c.toLowerCase()))
  return (
    <div data-field={field}>
      <div className="flex flex-wrap gap-1">
        {parts.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 rounded-full bg-[#0e2a63]/[0.07] px-2 py-0.5 font-utility text-xs text-[#0e2a63]">
            {p}
            {!disabled && (
              <button type="button" aria-label={`Remove ${p}`} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#0e2a63]/10" onClick={() => onChange(parts.filter((x) => x !== p).join(' / '))}>
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && left.length > 0 && (
        <select
          id={studioFieldId(field)}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          className={cn(SMALL, 'mt-1')}
          value=""
          onChange={(e) => e.target.value && onChange(addMake(value, e.target.value))}
          data-testid="make-picker"
        >
          <option value="">{parts.length ? 'Add another make…' : 'Choose a make…'}</option>
          {left.map((c) => (
            <option key={c} value={c}>
              {c === NO_MAKE ? '– (no make, e.g. installation)' : c}
            </option>
          ))}
        </select>
      )}
      {error && <p role="alert" className="mt-1 font-utility text-xs text-red-700">{error}</p>}
    </div>
  )
}

export function BoqRowsEditor({
  rows,
  onChange,
  editable,
  catalogue,
  errorFor,
}: {
  rows: BoqRow[]
  onChange: (rows: BoqRow[]) => void
  editable: boolean
  catalogue: string[]
  errorFor: (field: string) => string | null
}) {
  const choices = useMemo(() => makeChoices(catalogue, rows.map((r) => r.make)), [catalogue, rows])
  const set = (i: number, patch: Partial<BoqRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-3" data-testid="boq-editor">
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="rounded-lg border border-[#e4e8ee] p-3" data-testid="boq-row">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/55">Row {i + 1}</span>
              {editable && rows.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove row ${i + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
              <label className="block">
                <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">What it is</span>
                <input id={studioFieldId(`boq[${i}].description`)} className={SMALL} value={r.description} disabled={!editable} maxLength={160} onChange={(e) => set(i, { description: e.target.value })} aria-invalid={errorFor(`boq[${i}].description`) ? true : undefined} />
              </label>
              <label className="block">
                <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Quantity</span>
                <input id={studioFieldId(`boq[${i}].quantity`)} className={SMALL} value={r.quantity} disabled={!editable} maxLength={60} placeholder="e.g. 6 Nos." onChange={(e) => set(i, { quantity: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Standard (optional)</span>
                <input className={SMALL} value={r.standard ?? ''} disabled={!editable} maxLength={60} placeholder="e.g. IS 14286" onChange={(e) => set(i, { standard: e.target.value || null })} />
              </label>
            </div>
            <div className="mt-2">
              <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Make</span>
              <MakePicker field={`boq[${i}].make`} label={`Make for row ${i + 1}`} value={r.make} choices={choices} disabled={!editable} onChange={(make) => set(i, { make })} error={errorFor(`boq[${i}].make`)} />
            </div>
          </li>
        ))}
      </ol>
      {editable && rows.length < 30 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { description: '', quantity: '', standard: null, make: EQUIVALENT, kind: null }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add a row
        </Button>
      )}
    </div>
  )
}

const EMPTY_ITEM = (category: string, unit: string): StudioItem => ({ description: '', specification: null, make: EQUIVALENT, quantity: '', unit, unit_rate: '', category })

export function ItemsEditor({
  items,
  figures,
  onChange,
  editable,
  options,
  catalogue,
  errorFor,
}: {
  items: StudioItem[]
  figures: StudioItemFigure[] | undefined
  onChange: (items: StudioItem[]) => void
  editable: boolean
  options: StudioOptions
  catalogue: string[]
  errorFor: (field: string) => string | null
}) {
  const choices = useMemo(() => makeChoices(catalogue, items.map((r) => r.make)), [catalogue, items])
  const set = (i: number, patch: Partial<StudioItem>) => onChange(items.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const defaultCat = options.item_categories[0]?.id ?? ''
  const defaultUnit = options.item_units[0] ?? 'Nos.'

  return (
    <div className="space-y-3" data-testid="items-editor">
      <p className="font-utility text-xs text-[#111827]/60">Each line is priced as quantity × rate, with the GST of its category. The amounts are worked out for you after each save.</p>
      <ol className="space-y-3">
        {items.map((it, i) => {
          const fig = figures?.[i]
          return (
            <li key={i} className="rounded-lg border border-[#e4e8ee] p-3" data-testid="item-row">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-utility text-xs font-semibold uppercase tracking-wide text-[#111827]/55">Item {i + 1}</span>
                {editable && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="block">
                  <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">What it is</span>
                  <input id={studioFieldId(`items[${i}].description`)} className={SMALL} value={it.description} disabled={!editable} maxLength={160} onChange={(e) => set(i, { description: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Specification (optional)</span>
                  <input className={SMALL} value={it.specification ?? ''} disabled={!editable} maxLength={200} onChange={(e) => set(i, { specification: e.target.value || null })} />
                </label>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="block">
                  <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Quantity</span>
                  <input id={studioFieldId(`items[${i}].quantity`)} className={SMALL} inputMode="decimal" value={it.quantity} disabled={!editable} onChange={(e) => set(i, { quantity: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Unit</span>
                  <select className={SMALL} value={it.unit} disabled={!editable} onChange={(e) => set(i, { unit: e.target.value })}>
                    {options.item_units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Rate (₹ per unit, before GST)</span>
                  <input id={studioFieldId(`items[${i}].unit_rate`)} className={SMALL} inputMode="decimal" value={it.unit_rate} disabled={!editable} onChange={(e) => set(i, { unit_rate: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Category (sets GST)</span>
                  <select className={SMALL} value={it.category} disabled={!editable} onChange={(e) => set(i, { category: e.target.value })}>
                    {options.item_categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-2">
                <span className="mb-0.5 block font-utility text-xs text-[#111827]/65">Make</span>
                <MakePicker field={`items[${i}].make`} label={`Make for item ${i + 1}`} value={it.make} choices={choices} disabled={!editable} onChange={(make) => set(i, { make })} error={errorFor(`items[${i}].make`)} />
              </div>
              {fig && (
                <p className="mt-2 font-utility text-xs text-[#111827]/70" data-testid="item-amount">
                  Amount <Money value={fig.amount} /> · GST {fig.gst_percent}% <Money value={fig.gst} />
                </p>
              )}
            </li>
          )
        })}
      </ol>
      {editable && items.length < 60 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, EMPTY_ITEM(defaultCat, defaultUnit)])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add an item
        </Button>
      )}
    </div>
  )
}
