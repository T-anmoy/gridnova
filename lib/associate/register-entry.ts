// Pure helpers for the associate serial-entry form: draft rows, validation,
// the request body, and mapping the server's per-row errors back to the table.
// Ratings are strings and go back exactly as typed — no arithmetic here.
import { ApiError } from '@/lib/dashboard/api-error'
import type { CatalogueItem } from '@/components/execution/CataloguePicker'
import type { RowError, SerialCheck, UnitCategory, UnitInput } from './register-types'

export const MAX_ROWS = 200

export interface DraftRow {
  key: number
  category: UnitCategory
  /** True when the associate chose "My model is not listed". */
  unlisted: boolean
  equipment: CatalogueItem | null
  brand: string
  model: string
  serial: string
  rating: string
  /** Modules only; pre-filled and locked from the model list when a listed model is chosen. */
  dcr: 'yes' | 'no' | ''
  warrantyStart: string
  warrantyEnd: string
  check: SerialCheck | null
  checkState: 'idle' | 'checking' | 'failed'
}

let rowKey = 0
export const emptyRow = (): DraftRow => ({
  key: (rowKey += 1),
  category: 'module',
  unlisted: false,
  equipment: null,
  brand: '',
  model: '',
  serial: '',
  rating: '',
  dcr: '',
  warrantyStart: '',
  warrantyEnd: '',
  check: null,
  checkState: 'idle',
})

export const isDirty = (r: DraftRow) =>
  !!(r.serial || r.rating || r.equipment || r.brand || r.model || r.warrantyStart || r.warrantyEnd || r.dcr)

export type RowProblem = 'serialRequired' | 'modelRequired' | 'brandRequired' | 'modelPrintedRequired' | 'ratingRequired' | 'dcrRequired' | 'warrantyPair'

/** Local checks only for what the contract makes mandatory. Nothing here judges a rating or a capacity. */
export function validateRow(r: DraftRow): RowProblem[] {
  const out: RowProblem[] = []
  if (!r.serial.trim()) out.push('serialRequired')
  if (r.category !== 'other') {
    if (r.unlisted) {
      if (!r.brand.trim()) out.push('brandRequired')
      if (!r.model.trim()) out.push('modelPrintedRequired')
    } else if (!r.equipment) {
      out.push('modelRequired')
    }
    if (!r.rating.trim()) out.push('ratingRequired')
    if (r.category === 'module' && r.unlisted && !r.dcr) out.push('dcrRequired')
  }
  if (!!r.warrantyStart !== !!r.warrantyEnd) out.push('warrantyPair')
  return out
}

export function toInput(r: DraftRow): UnitInput {
  const base: UnitInput = { category: r.category, serial_number: r.serial.trim() }
  if (r.category !== 'other') {
    if (r.unlisted) {
      base.brand_as_printed = r.brand.trim()
      base.model_as_printed = r.model.trim()
    } else if (r.equipment) {
      base.equipment_id = r.equipment.id
    }
  }
  if (r.category === 'module') {
    base.rating_wp = r.rating.trim()
    if (r.unlisted) base.is_dcr = r.dcr === 'yes'
    else if (r.equipment) base.is_dcr = r.equipment.is_dcr_compliant
  }
  if (r.category === 'inverter') base.rating_kw = r.rating.trim()
  if (r.warrantyStart && r.warrantyEnd) {
    base.warranty_start = r.warrantyStart
    base.warranty_end = r.warrantyEnd
  }
  return base
}

/**
 * `errors[].row` is the 0-BASED index of the row in the list that was sent.
 * Empty rows aren't sent, so map back through the rows actually sent to the
 * table position. Errors whose index points at no sent row are returned apart.
 */
export function mapRowErrors(sentTableIndexes: number[], errors: RowError[]): { byTableIndex: Map<number, RowError[]>; unmapped: RowError[] } {
  const byTableIndex = new Map<number, RowError[]>()
  const unmapped: RowError[] = []
  for (const e of errors) {
    const at = sentTableIndexes[e.row]
    if (at === undefined) {
      unmapped.push(e)
      continue
    }
    byTableIndex.set(at, [...(byTableIndex.get(at) ?? []), e])
  }
  return { byTableIndex, unmapped }
}

export function rowErrorsOf(err: unknown): RowError[] {
  if (!(err instanceof ApiError)) return []
  const list = err.structuredDetail?.errors
  if (!Array.isArray(list)) return []
  return list.filter((e): e is RowError => !!e && typeof e === 'object' && typeof (e as RowError).code === 'string' && typeof (e as RowError).row === 'number')
}

export interface EntryErrorCopy {
  generic: string
  brandMissing: string
  modelMissing: string
  [code: string]: string
}

/** Plain, localised words for a contract error code; falls back to the server's own sentence, then a generic one. */
export function entryErrorText(code: string | undefined, field: string | undefined, serverMessage: string | undefined, copy: EntryErrorCopy): string {
  if (code === 'equipment_required') {
    if (field === 'brand_as_printed') return copy.brandMissing
    if (field === 'model_as_printed') return copy.modelMissing
  }
  if (code && code !== 'generic' && typeof copy[code] === 'string') return copy[code]
  return serverMessage || copy.generic
}

export function entryErrorOf(err: unknown, copy: EntryErrorCopy): string {
  if (err instanceof ApiError) {
    const sd = err.structuredDetail
    const code = typeof sd?.code === 'string' ? sd.code : undefined
    const field = typeof sd?.field === 'string' ? sd.field : undefined
    // Only trust the server's English sentence when there is no code we can translate.
    return entryErrorText(code, field, undefined, copy)
  }
  return copy.generic
}
