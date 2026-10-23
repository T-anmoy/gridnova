// Rate-schedule rules the form can check before the server does. The server stays the
// authority (it still refuses with 422 notice_period / effective_in_past / invalid_rate);
// everything here works on strings — a rate is never turned into a number.

const RATE = /^(\d{1,3})(?:\.(\d{1,4}))?$/

/** 0–100 with at most 4 decimals (the contract's `invalid_rate` rule). */
export function isValidRate(value: string): boolean {
  const m = RATE.exec(value.trim())
  if (!m) return false
  const whole = Number.parseInt(m[1], 10)
  if (whole > 100) return false
  return whole < 100 || !/[1-9]/.test(m[2] ?? '')
}

/** "5.0000" → "5", "2.5000" → "2.5". String trimming only. */
export function formatRate(rate: string | null | undefined): string {
  if (rate == null || rate === '') return '—'
  const trimmed = rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate
  return `${trimmed}%`
}

export type EffectiveFromProblem = 'required' | 'notice_period' | 'effective_in_past'

/**
 * The contract's date rules. A real schedule must start on or after
 * `earliest_effective_from` (today in IST + the notice period); a placeholder one
 * only may not start in the past. Dates are YYYY-MM-DD, so string order is date order.
 */
export function effectiveFromProblem(input: {
  effectiveFrom: string
  isPlaceholder: boolean
  earliestEffectiveFrom: string
  todayIst: string
}): EffectiveFromProblem | null {
  const { effectiveFrom, isPlaceholder, earliestEffectiveFrom, todayIst } = input
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return 'required'
  if (isPlaceholder) return effectiveFrom < todayIst ? 'effective_in_past' : null
  return effectiveFrom < earliestEffectiveFrom ? 'notice_period' : null
}

// Plain-English names for the rate keys. Both Associate keys are listed on purpose: an Associate
// has one personal-sale key (sales or execution), fixed for life, and the standard schedule must
// carry a rate for each.
const KEY_LABEL: Record<string, string> = {
  'personal_sale.associate.sales': 'Associate — sales',
  'personal_sale.associate.execution': 'Associate — execution',
  'personal_sale.preferred_associate.state_head': 'Preferred Associate — State Head',
  'personal_sale.preferred_associate.district_head': 'Preferred Associate — District Head',
  'personal_sale.preferred_associate.block': 'Preferred Associate — Block',
  territory_state: 'Territory — State',
  territory_district: 'Territory — District',
  territory_block: 'Territory — Block',
}

const TOKEN: Record<string, string> = {
  personal_sale: 'Personal sale',
  associate: 'Associate',
  preferred_associate: 'Preferred Associate',
  sales: 'sales',
  execution: 'execution',
  state_head: 'State Head',
  district_head: 'District Head',
  block: 'Block',
}

/** "personal_sale.preferred_associate.state_head" → "Preferred Associate — State Head". Unknown keys read as plain words. */
export function rateKeyLabel(key: string): string {
  if (KEY_LABEL[key]) return KEY_LABEL[key]
  return key
    .split('.')
    .map((t) => TOKEN[t] ?? t.replace(/_/g, ' '))
    .join(' · ')
}
