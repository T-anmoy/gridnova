// Money arrives from the API as decimal strings ("1234567.89") and is only ever
// shown, never calculated, in the browser. Formatting works on the digits of
// the string itself — no parseFloat/Number — so no precision can be lost.

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/

/** "1234567.89" → "₹12,34,567.89" (Indian lakh/crore grouping). Unparseable input is returned untouched. */
export function formatInr(amount: string | null | undefined): string {
  if (amount == null || amount === '') return '—'
  const m = DECIMAL.exec(amount.trim())
  if (!m) return amount
  const [, sign = '', whole, fraction] = m
  const digits = whole.replace(/^0+(?=\d)/, '')
  const grouped =
    digits.length > 3
      ? `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${digits.slice(-3)}`
      : digits
  return `${sign}₹${grouped}${fraction ? `.${fraction}` : ''}`
}

/** Format check only (positive amount, at most 2 decimals) — the server stays the authority. */
export function isAmountShapeValid(value: string): boolean {
  const v = value.trim()
  return /^\d+(\.\d{1,2})?$/.test(v) && /[1-9]/.test(v)
}

const NONZERO_DIGIT = /[1-9]/

/** True for a negative decimal string ("-1000.00"). Reads the string; no number is ever built. */
export function isNegativeAmount(amount: string | null | undefined): boolean {
  const a = amount?.trim()
  return !!a && a.startsWith('-') && NONZERO_DIGIT.test(a)
}

/** True for a strictly positive decimal string ("0.00" and "-5" are not). */
export function isPositiveAmount(amount: string | null | undefined): boolean {
  const a = amount?.trim()
  return !!a && !a.startsWith('-') && DECIMAL.test(a) && NONZERO_DIGIT.test(a)
}
