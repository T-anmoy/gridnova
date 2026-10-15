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

const TOKEN: Record<string, string> = {
  personal_sale: 'Personal sale',
  associate: 'Associate',
  preferred_associate: 'Preferred Associate',
  sales: 'sales',
  execution: 'execution',
  state_head: 'State Head',
  district_head: 'District Head',
  block: 'Block',
  territory_state: 'Territory — state',
  territory_district: 'Territory — district',
  territory_block: 'Territory — block',
}

/** "personal_sale.preferred_associate.state_head" → "Personal sale · Preferred Associate · State Head". */
export function rateKeyLabel(key: string): string {
  if (TOKEN[key]) return TOKEN[key]
  return key
    .split('.')
    .map((t) => TOKEN[t] ?? t.replace(/_/g, ' '))
    .join(' · ')
}
